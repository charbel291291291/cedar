-- Enable full replica identity so UPDATE events include OLD row data
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.topup_requests REPLICA IDENTITY FULL;

-- Add tables to realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'topup_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.topup_requests;
  END IF;
END $$;

-- RPC: place_wallet_order — atomically deduct balance and create a paid order
CREATE OR REPLACE FUNCTION public.place_wallet_order(
  p_service_id   uuid,
  p_package_id   uuid,
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

  -- Get package price
  SELECT price INTO v_price
  FROM packages
  WHERE id = p_package_id AND service_id = p_service_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_not_found');
  END IF;

  -- Lock user row and check balance
  SELECT balance INTO v_balance
  FROM users
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_balance');
  END IF;

  -- Deduct balance
  UPDATE users SET balance = balance - v_price WHERE id = v_user_id;

  -- Create paid order
  INSERT INTO orders (user_id, service_id, package_id, target_user_id, status, payment_method)
  VALUES (v_user_id, p_service_id, p_package_id, p_target_user_id, 'paid', 'wallet')
  RETURNING id INTO v_order_id;

  -- Record debit transaction
  INSERT INTO transactions (user_id, amount, method, status, order_id, description)
  VALUES (v_user_id, v_price, 'wallet', 'completed', v_order_id, 'Wallet payment for order');

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_wallet_order(uuid, uuid, text) TO authenticated;
