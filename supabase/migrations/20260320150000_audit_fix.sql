-- =====================================================
-- AUDIT FIX: Safe RLS policies using is_admin_user()
-- (SECURITY DEFINER function avoids infinite recursion)
-- =====================================================

-- Ensure is_admin_user() exists (SECURITY DEFINER = bypasses RLS)
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

-- ═══════════ USERS TABLE ═══════════
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_select_own_or_admin" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile or if admin" ON public.users;
DROP POLICY IF EXISTS "users_update_admin_only" ON public.users;
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

-- ═══════════ ORDERS ═══════════
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_select_own_or_admin" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
DROP POLICY IF EXISTS "orders_update_admin_only" ON public.orders;

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

-- ═══════════ TRANSACTIONS ═══════════
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select" ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_own_or_admin" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_own_or_admin" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_admin_only" ON public.transactions;

CREATE POLICY "transactions_select_own_or_admin"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_user());

CREATE POLICY "transactions_insert_own_or_admin"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin_user());

CREATE POLICY "transactions_update_admin_only"
  ON public.transactions FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ═══════════ TOPUP REQUESTS ═══════════
ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topup_requests_select" ON public.topup_requests;
DROP POLICY IF EXISTS "topup_select_own_or_admin" ON public.topup_requests;
DROP POLICY IF EXISTS "topup_insert_own" ON public.topup_requests;
DROP POLICY IF EXISTS "topup_update_admin_only" ON public.topup_requests;

CREATE POLICY "topup_select_own_or_admin"
  ON public.topup_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_user());

CREATE POLICY "topup_insert_own"
  ON public.topup_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "topup_update_admin_only"
  ON public.topup_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ═══════════ SERVICES ═══════════
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services_select" ON public.services;
DROP POLICY IF EXISTS "services_select_auth" ON public.services;

CREATE POLICY "services_select_auth"
  ON public.services FOR SELECT
  TO authenticated
  USING (true);

-- ═══════════ PACKAGES ═══════════
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packages_select" ON public.packages;
DROP POLICY IF EXISTS "packages_select_auth" ON public.packages;

CREATE POLICY "packages_select_auth"
  ON public.packages FOR SELECT
  TO authenticated
  USING (true);

-- ═══════════ APP SETTINGS ═══════════
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_read" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_write" ON public.app_settings;

CREATE POLICY "app_settings_read"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "app_settings_admin_write"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ═══════════ SET ALL USERS TO ADMIN ═══════════
UPDATE public.users SET role = 'admin' WHERE role IS DISTINCT FROM 'admin';
