-- Add direction column to transactions so the UI can distinguish
-- credits (+) from debits (-) without parsing description strings.
-- direction: 'credit' = balance increased, 'debit' = balance decreased, 'neutral' = no balance change (e.g. rejected)

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'debit'
  CHECK (direction IN ('credit', 'debit', 'neutral'));

-- ─── Backfill existing rows ───
-- Top-up approvals are credits
UPDATE public.transactions
SET direction = 'credit'
WHERE description ILIKE '%top-up approved%'
   OR description ILIKE '%wallet top-up approved%';

-- Rejected transactions had no balance effect
UPDATE public.transactions
SET direction = 'neutral'
WHERE status = 'rejected';

-- ─── Update approve_topup_request to set direction = 'credit' ───
CREATE OR REPLACE FUNCTION public.approve_topup_request(p_topup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.topup_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO r
  FROM public.topup_requests
  WHERE id = p_topup_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_processed');
  END IF;

  UPDATE public.users
  SET balance = COALESCE(balance, 0) + r.amount
  WHERE id = r.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User row missing for top-up recipient';
  END IF;

  UPDATE public.topup_requests
  SET status = 'approved'
  WHERE id = p_topup_id;

  INSERT INTO public.transactions (
    user_id, amount, method, status, topup_id, description, reference, direction
  )
  VALUES (
    r.user_id, r.amount, r.payment_method, 'completed', r.id,
    'Wallet top-up approved', 'topup:' || r.id::text, 'credit'
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_topup_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_topup_request(uuid) TO authenticated;

-- ─── Update reject_topup_request to set direction = 'neutral' ───
CREATE OR REPLACE FUNCTION public.reject_topup_request(p_topup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.topup_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO r
  FROM public.topup_requests
  WHERE id = p_topup_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_processed');
  END IF;

  UPDATE public.topup_requests
  SET status = 'rejected'
  WHERE id = p_topup_id;

  INSERT INTO public.transactions (
    user_id, amount, method, status, topup_id, description, reference, direction
  )
  VALUES (
    r.user_id, r.amount, r.payment_method, 'rejected', r.id,
    'Wallet top-up rejected by admin', 'topup:' || r.id::text, 'neutral'
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_topup_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_topup_request(uuid) TO authenticated;

-- ─── Update place_wallet_order to set direction = 'debit' (explicit) ───
CREATE OR REPLACE FUNCTION public.place_wallet_order(
  p_service_id     uuid,
  p_package_id     uuid,
  p_target_user_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_price    numeric;
  v_balance  numeric;
  v_order_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT price INTO v_price
  FROM packages
  WHERE id = p_package_id AND service_id = p_service_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_not_found');
  END IF;

  SELECT balance INTO v_balance
  FROM users
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_balance');
  END IF;

  UPDATE users SET balance = balance - v_price WHERE id = v_user_id;

  INSERT INTO orders (user_id, service_id, package_id, target_user_id, status, payment_method)
  VALUES (v_user_id, p_service_id, p_package_id, p_target_user_id, 'paid', 'wallet')
  RETURNING id INTO v_order_id;

  INSERT INTO transactions (user_id, amount, method, status, order_id, description, direction)
  VALUES (v_user_id, v_price, 'wallet', 'completed', v_order_id, 'Wallet payment for order', 'debit');

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_wallet_order(uuid, uuid, text) TO authenticated;

-- ─── Update record_order_payment_transaction trigger to set direction = 'debit' ───
CREATE OR REPLACE FUNCTION public.record_order_payment_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt numeric;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.transactions WHERE order_id = NEW.id
    AND direction = 'debit'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT price INTO amt
  FROM public.packages
  WHERE id = NEW.package_id;

  INSERT INTO public.transactions (
    user_id, amount, method, status, order_id, description, direction
  )
  VALUES (
    NEW.user_id, COALESCE(amt, 0),
    COALESCE(NEW.payment_method, 'order'),
    'completed', NEW.id,
    'Order payment confirmed', 'debit'
  );

  RETURN NEW;
END;
$$;
