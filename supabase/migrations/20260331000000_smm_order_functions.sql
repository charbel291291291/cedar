-- =============================================================
-- SMM ORDER PLACEMENT SUPPORT
-- Required by the secure-order-placement Edge Function
-- =============================================================

-- ── 1. Extra columns on orders (safe to run multiple times) ──
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cost              numeric,
  ADD COLUMN IF NOT EXISTS supplier_order_id text,
  ADD COLUMN IF NOT EXISTS last_checked_at  timestamptz,
  ADD COLUMN IF NOT EXISTS request_id       text;

-- Unique constraint for request deduplication (idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_request_id_key' AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_request_id_key UNIQUE (request_id);
  END IF;
END $$;


-- ── 2. Rate-limit log table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id           bigserial PRIMARY KEY,
  identifier   text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_log_identifier_time
  ON public.rate_limit_log (identifier, created_at DESC);

-- No RLS needed — only accessed via SECURITY DEFINER functions


-- ── 3. check_rate_limit(identifier, limit, window_seconds) ───
-- Returns TRUE when the request is allowed, FALSE when rate-limited.
-- Atomically records the request so concurrent calls are safe.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier    text,
  p_limit         int,
  p_window_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz := now() - (p_window_seconds || ' seconds')::interval;
  v_count        int;
BEGIN
  -- Count requests inside the window
  SELECT COUNT(*) INTO v_count
    FROM rate_limit_log
   WHERE identifier = p_identifier
     AND created_at >= v_window_start;

  IF v_count >= p_limit THEN
    RETURN false;
  END IF;

  -- Record this request
  INSERT INTO rate_limit_log (identifier) VALUES (p_identifier);

  -- Prune old rows for this identifier to keep the table small
  DELETE FROM rate_limit_log
   WHERE identifier = p_identifier
     AND created_at < v_window_start;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, int, int) TO authenticated, service_role;


-- ── 4. process_smm_wallet_deduction_v2 ───────────────────────
-- Atomically:
--   a) verifies the user has enough balance
--   b) deducts the cost
--   c) logs a debit transaction
--   d) creates the order record
--   e) returns the new order UUID
-- Raises an exception that the edge function catches:
--   "insufficient_balance" → shown to user
--   "unique_request_id"    → duplicate request guard (idempotent retry)
CREATE OR REPLACE FUNCTION public.process_smm_wallet_deduction_v2(
  p_user_id    uuid,
  p_cost       numeric,
  p_service_id text,
  p_quantity   int,
  p_link       text,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance  numeric;
  v_order_id uuid;
BEGIN
  -- Lock the user row to prevent race conditions
  SELECT balance INTO v_balance
    FROM users
   WHERE id = p_user_id
   FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_balance < p_cost THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Deduct balance
  UPDATE users
     SET balance = balance - p_cost
   WHERE id = p_user_id;

  -- Create order (request_id UNIQUE constraint prevents duplicates)
  INSERT INTO orders (
    user_id,
    service_id,
    package_id,
    target_user_id,
    status,
    payment_method,
    cost,
    request_id
  )
  VALUES (
    p_user_id,
    p_service_id,                         -- SMM service id (stored as text in service_id column)
    p_service_id,                         -- package_id reuses service_id for SMM orders
    p_link,
    'processing',
    'wallet',
    p_cost,
    p_request_id
  )
  RETURNING id INTO v_order_id;

  -- Log debit transaction
  INSERT INTO transactions (user_id, amount, method, status, direction, description)
  VALUES (
    p_user_id,
    p_cost,
    'wallet',
    'completed',
    'debit',
    'SMM order — service ' || p_service_id || ' × ' || p_quantity
  );

  RETURN v_order_id;

EXCEPTION
  WHEN unique_violation THEN
    -- Constraint orders_request_id_key fired — idempotent: return existing order
    SELECT id INTO v_order_id FROM orders WHERE request_id = p_request_id;
    IF v_order_id IS NOT NULL THEN
      RETURN v_order_id;
    END IF;
    RAISE EXCEPTION 'unique_request_id';
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_smm_wallet_deduction_v2(uuid, numeric, text, int, text, text) TO service_role;


-- ── 5. secure_refund_smm_order ────────────────────────────────
-- Called when the supplier rejects the order.
-- Refunds the cost back to the user and marks the order as failed.
CREATE OR REPLACE FUNCTION public.secure_refund_smm_order(
  p_order_id     uuid,
  p_user_id      uuid,
  p_refund_amount numeric,
  p_reason       text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Credit wallet
  UPDATE users
     SET balance = balance + p_refund_amount
   WHERE id = p_user_id;

  -- Mark order as failed
  UPDATE orders
     SET status = 'failed'
   WHERE id = p_order_id AND user_id = p_user_id;

  -- Log refund transaction
  INSERT INTO transactions (user_id, amount, method, status, direction, description)
  VALUES (
    p_user_id,
    p_refund_amount,
    'REFUND',
    'completed',
    'credit',
    'Auto-refund — supplier rejected: ' || COALESCE(p_reason, 'unknown')
  );

  -- Notify user
  INSERT INTO notifications (user_id, type, message, status, read)
  VALUES (
    p_user_id,
    'refund',
    '+$' || p_refund_amount || ' refunded — order rejected by supplier.',
    'completed',
    false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.secure_refund_smm_order(uuid, uuid, numeric, text) TO service_role;
