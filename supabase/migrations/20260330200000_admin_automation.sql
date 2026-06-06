
-- ============================================================
-- AUTO-APPROVE SMALL DEPOSITS
-- Admin sets threshold in app_settings.
-- Any deposit <= threshold is approved instantly on INSERT.
-- ============================================================

-- Ensure auto_approve_threshold exists in settings
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('auto_approve_threshold', '0', now())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.auto_approve_small_deposit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold numeric := 0;
BEGIN
  -- Read threshold (safe cast)
  BEGIN
    SELECT COALESCE(value, '0')::numeric INTO v_threshold
      FROM app_settings WHERE key = 'auto_approve_threshold';
  EXCEPTION WHEN OTHERS THEN
    v_threshold := 0;
  END;

  -- Skip if disabled or amount exceeds threshold
  IF v_threshold <= 0 OR NEW.amount > v_threshold THEN
    RETURN NEW;
  END IF;

  -- Credit wallet
  UPDATE users SET balance = balance + NEW.amount WHERE id = NEW.user_id;

  -- Log transaction
  INSERT INTO transactions (user_id, amount, method, status, direction, description)
  VALUES (
    NEW.user_id,
    NEW.amount,
    NEW.method,
    'completed',
    'credit',
    'Auto-approved deposit via ' || NEW.method
  );

  -- Notify user
  INSERT INTO notifications (user_id, type, message, status, read)
  VALUES (
    NEW.user_id,
    'topup',
    '+$' || NEW.amount || ' auto-approved instantly!',
    'completed',
    false
  );

  -- Mark as approved before row is inserted
  NEW.status := 'approved';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_approve_deposit ON public.deposit_requests;
CREATE TRIGGER trigger_auto_approve_deposit
  BEFORE INSERT ON public.deposit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_small_deposit();


-- ============================================================
-- BULK ORDER STATUS UPDATE (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_update_order_status(
  p_order_ids uuid[],
  p_status    text
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
BEGIN
  -- Only allow known statuses
  IF p_status NOT IN ('completed', 'canceled', 'processing', 'pending') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE orders SET status = p_status WHERE id = ANY(p_order_ids);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;


-- ============================================================
-- BULK REFUND ORDERS (admin only)
-- Refunds cost back to user wallet for each order in array
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_refund_orders(p_order_ids uuid[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order  record;
  affected int := 0;
BEGIN
  FOR v_order IN
    SELECT id, user_id, cost
      FROM orders
     WHERE id = ANY(p_order_ids)
       AND status != 'refunded'
  LOOP
    IF v_order.cost IS NOT NULL AND v_order.cost > 0 THEN
      -- Credit wallet
      UPDATE users SET balance = balance + v_order.cost WHERE id = v_order.user_id;
      -- Log transaction
      INSERT INTO transactions (user_id, amount, method, status, direction, description)
      VALUES (v_order.user_id, v_order.cost, 'REFUND', 'completed', 'credit',
              'Admin refund — order #' || substring(v_order.id::text, 1, 8));
      -- Notify user
      INSERT INTO notifications (user_id, type, message, status, read)
      VALUES (v_order.user_id, 'topup',
              '+$' || v_order.cost || ' refunded by admin.',
              'completed', false);
    END IF;
    -- Mark as refunded
    UPDATE orders SET status = 'canceled' WHERE id = v_order.id;
    affected := affected + 1;
  END LOOP;

  RETURN affected;
END;
$$;


-- ============================================================
-- REVENUE ANALYTICS (admin only)
-- Returns aggregated data for the last N days
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_analytics(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since         timestamptz := now() - (p_days || ' days')::interval;
  v_revenue       numeric;
  v_order_count   int;
  v_new_users     int;
  v_avg_order     numeric;
  v_daily_revenue jsonb;
  v_daily_orders  jsonb;
  v_status_breakdown jsonb;
  v_top_services  jsonb;
BEGIN
  -- Total approved deposit revenue
  SELECT COALESCE(SUM(amount), 0) INTO v_revenue
    FROM deposit_requests
   WHERE status = 'approved' AND created_at >= v_since;

  -- Total orders
  SELECT COUNT(*) INTO v_order_count
    FROM orders WHERE created_at >= v_since;

  -- New users
  SELECT COUNT(*) INTO v_new_users
    FROM users WHERE created_at >= v_since;

  -- Avg order cost
  SELECT COALESCE(AVG(cost), 0) INTO v_avg_order
    FROM orders WHERE created_at >= v_since AND cost IS NOT NULL;

  -- Daily revenue (last N days)
  SELECT jsonb_agg(row ORDER BY row->>'day') INTO v_daily_revenue
  FROM (
    SELECT jsonb_build_object(
      'day',     to_char(DATE(created_at), 'Mon DD'),
      'revenue', ROUND(SUM(amount)::numeric, 2)
    ) AS row
    FROM deposit_requests
    WHERE status = 'approved' AND created_at >= v_since
    GROUP BY DATE(created_at)
  ) sub;

  -- Daily orders count
  SELECT jsonb_agg(row ORDER BY row->>'day') INTO v_daily_orders
  FROM (
    SELECT jsonb_build_object(
      'day',    to_char(DATE(created_at), 'Mon DD'),
      'orders', COUNT(*)
    ) AS row
    FROM orders
    WHERE created_at >= v_since
    GROUP BY DATE(created_at)
  ) sub;

  -- Order status breakdown
  SELECT jsonb_agg(row) INTO v_status_breakdown
  FROM (
    SELECT jsonb_build_object('status', status, 'count', COUNT(*)) AS row
    FROM orders GROUP BY status
  ) sub;

  -- Top 5 services by order volume
  SELECT jsonb_agg(row) INTO v_top_services
  FROM (
    SELECT jsonb_build_object(
      'service_id', service_id,
      'count',      COUNT(*),
      'revenue',    ROUND(COALESCE(SUM(cost), 0)::numeric, 2)
    ) AS row
    FROM orders
    WHERE created_at >= v_since
    GROUP BY service_id
    ORDER BY COUNT(*) DESC
    LIMIT 5
  ) sub;

  RETURN jsonb_build_object(
    'total_revenue',     v_revenue,
    'total_orders',      v_order_count,
    'new_users',         v_new_users,
    'avg_order_value',   ROUND(v_avg_order, 4),
    'daily_revenue',     COALESCE(v_daily_revenue, '[]'::jsonb),
    'daily_orders',      COALESCE(v_daily_orders,  '[]'::jsonb),
    'status_breakdown',  COALESCE(v_status_breakdown, '[]'::jsonb),
    'top_services',      COALESCE(v_top_services, '[]'::jsonb)
  );
END;
$$;

-- Grant to authenticated (RLS on admin check is done at app level)
GRANT EXECUTE ON FUNCTION public.bulk_update_order_status(uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_refund_orders(uuid[])              TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics(int)               TO authenticated;
