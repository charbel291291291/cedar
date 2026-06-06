-- Helper: admin check (SECURITY DEFINER bypasses RLS on users)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- Credit wallet (admin-only). Use from tooling or future flows.
CREATE OR REPLACE FUNCTION public.increment_balance(user_id uuid, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  UPDATE public.users
  SET balance = COALESCE(balance, 0) + amount
  WHERE id = user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_balance(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_balance(uuid, numeric) TO authenticated;

-- Atomic top-up approval: pending only, prevents double-credit (FOR UPDATE)
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

  SELECT *
  INTO r
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

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_topup_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_topup_request(uuid) TO authenticated;

-- ─── users RLS ───
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own user row" ON public.users;
DROP POLICY IF EXISTS "Users can update own user row" ON public.users;

CREATE POLICY "users_select_own_or_admin"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin_user());

CREATE POLICY "users_update_admin_only"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ─── topup_requests RLS ───
ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create topup requests" ON public.topup_requests;
DROP POLICY IF EXISTS "Users can view own topup requests" ON public.topup_requests;
DROP POLICY IF EXISTS "Admins can view all topup requests" ON public.topup_requests;
DROP POLICY IF EXISTS "Admins can update topup requests" ON public.topup_requests;

CREATE POLICY "topup_insert_own"
  ON public.topup_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "topup_select_own_or_admin"
  ON public.topup_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_user());

CREATE POLICY "topup_update_admin_only"
  ON public.topup_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ─── transactions RLS ───
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;

CREATE POLICY "transactions_select_own_or_admin"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_user());

CREATE POLICY "transactions_update_admin_only"
  ON public.transactions FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "transactions_insert_own_or_admin"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin_user());

-- ─── orders RLS (remove overly permissive policies) ───
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON public.orders;

CREATE POLICY "orders_select_own_or_admin"
  ON public.orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_user());

CREATE POLICY "orders_insert_own"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "orders_update_admin_only"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());
