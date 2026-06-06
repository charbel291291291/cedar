-- Production hardening: storage privacy & paths, profiles removal, supplier_mappings,
-- supplier_logs, transactions columns, topup FK, claim_order RPC, order payment ledger.

-- ─── 1) Single user table: drop legacy profiles ───
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─── 2) transactions: link to orders / topups + metadata ───
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS topup_id uuid REFERENCES public.topup_requests (id) ON DELETE SET NULL;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_id text;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS meta jsonb;

-- ─── 3) topup_requests → users FK (clean orphans first) ───
DELETE FROM public.topup_requests t
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = t.user_id);

ALTER TABLE public.topup_requests
  DROP CONSTRAINT IF EXISTS topup_requests_user_id_fkey;

ALTER TABLE public.topup_requests
  ADD CONSTRAINT topup_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;

-- ─── 4) supplier_mappings (DB-driven supplier codes) ───
CREATE TABLE IF NOT EXISTS public.supplier_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  service_id uuid NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.packages (id) ON DELETE CASCADE,
  supplier_service_code text NOT NULL,
  supplier_package_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (service_id, package_id)
);

ALTER TABLE public.supplier_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_mappings_select_auth" ON public.supplier_mappings;
CREATE POLICY "supplier_mappings_select_auth" ON public.supplier_mappings FOR SELECT TO authenticated USING (true);

-- Seed from catalog (adjust codes in SQL or Admin tooling for production)
INSERT INTO public.supplier_mappings (
  service_id,
  package_id,
  supplier_service_code,
  supplier_package_code
)
SELECT
  s.id,
  p.id,
  CASE
    WHEN s.name ILIKE '%xena%' THEN 'SERVICE_101'
    WHEN s.name ILIKE '%yoho%' THEN 'SERVICE_202'
    WHEN s.name ILIKE '%soul%' THEN 'SERVICE_303'
    ELSE 'SERVICE_UNKNOWN'
  END,
  CASE
    WHEN s.name ILIKE '%xena%' THEN 'PKG_XENA_001'
    WHEN s.name ILIKE '%yoho%' THEN 'PKG_YOHO_001'
    WHEN s.name ILIKE '%soul%' THEN 'PKG_SOUL_001'
    ELSE 'PKG_DEFAULT'
  END
FROM public.services s
JOIN public.packages p ON p.service_id = s.id
ON CONFLICT (service_id, package_id) DO NOTHING;

-- ─── 5) supplier_logs (admin-readable; writes via service role from Edge) ───
CREATE TABLE IF NOT EXISTS public.supplier_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  request jsonb,
  response jsonb,
  status text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.supplier_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_logs_admin_select" ON public.supplier_logs;
CREATE POLICY "supplier_logs_admin_select" ON public.supplier_logs FOR SELECT TO authenticated USING (public.is_admin_user());

-- ─── 6) app_settings (e.g. USDT wallet) ───
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_read" ON public.app_settings;
CREATE POLICY "app_settings_read" ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "app_settings_admin_write" ON public.app_settings;
CREATE POLICY "app_settings_admin_write" ON public.app_settings FOR ALL TO authenticated USING (public.is_admin_user ())
WITH
  CHECK (public.is_admin_user ());

INSERT INTO public.app_settings (key, value)
VALUES ('usdt_wallet_address', '')
ON CONFLICT (key) DO NOTHING;

-- ─── 7) Ledger row when order becomes paid (idempotent per order) ───
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
    SELECT
      1
    FROM
      public.transactions
    WHERE
      order_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT
    price INTO amt
  FROM
    public.packages
  WHERE
    id = NEW.package_id;

  INSERT INTO public.transactions (
    user_id,
    amount,
    method,
    status,
    order_id,
    description
  )
  VALUES (
    NEW.user_id,
    COALESCE(amt, 0),
    COALESCE(NEW.payment_method, 'order'),
    'completed',
    NEW.id,
    'Order payment confirmed'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_paid_transaction ON public.orders;

CREATE TRIGGER orders_paid_transaction
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (
    NEW.status = 'paid'
    AND (
      OLD.status IS DISTINCT
      FROM
        'paid'
    )
  )
  EXECUTE FUNCTION public.record_order_payment_transaction();

-- ─── 8) approve_topup_request: record transaction ───
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

  SELECT
    *
  INTO r
  FROM
    public.topup_requests
  WHERE
    id = p_topup_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_processed');
  END IF;

  UPDATE public.users
  SET
    balance = COALESCE(balance, 0) + r.amount
  WHERE
    id = r.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User row missing for top-up recipient';
  END IF;

  UPDATE public.topup_requests
  SET
    status = 'approved'
  WHERE
    id = p_topup_id;

  INSERT INTO public.transactions (
    user_id,
    amount,
    method,
    status,
    topup_id,
    description,
    reference
  )
  VALUES (
    r.user_id,
    r.amount,
    r.payment_method,
    'completed',
    r.id,
    'Wallet top-up approved',
    'topup:' || r.id::text
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_topup_request(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.approve_topup_request(uuid) TO authenticated;

-- ─── 9) Admin claims paid order for supplier pipeline (Edge Function step 1) ───
CREATE OR REPLACE FUNCTION public.claim_order_for_supplier(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  sm public.supplier_mappings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT
    *
  INTO o
  FROM
    public.orders
  WHERE
    id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF o.status IS DISTINCT FROM 'paid' THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'reason',
      'invalid_status',
      'current',
      o.status
    );
  END IF;

  UPDATE public.orders
  SET
    status = 'processing'
  WHERE
    id = p_order_id;

  SELECT
    *
  INTO sm
  FROM
    public.supplier_mappings
  WHERE
    service_id = o.service_id
    AND package_id = o.package_id;

  IF NOT FOUND THEN
    UPDATE public.orders
    SET
      status = 'paid'
    WHERE
      id = p_order_id;

    RETURN jsonb_build_object('ok', false, 'reason', 'no_mapping');
  END IF;

  RETURN jsonb_build_object(
    'ok',
    true,
    'order_id',
    o.id,
    'target',
    o.target_user_id,
    'supplier_service',
    sm.supplier_service_code,
    'supplier_package',
    sm.supplier_package_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_for_supplier(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_order_for_supplier(uuid) TO authenticated;

-- ─── 10) Storage: private bucket + owner / admin read + path prefix = uid ───
UPDATE storage.buckets
SET
  public = false
WHERE
  id = 'payment-proofs';

DROP POLICY IF EXISTS "Users can upload proofs" ON storage.objects;

DROP POLICY IF EXISTS "Proofs are viewable" ON storage.objects;

CREATE POLICY "payment_proofs_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH
  CHECK (
    bucket_id = 'payment-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "payment_proofs_select_own_or_admin"
ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'payment-proofs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin_user()
  )
);

CREATE POLICY "payment_proofs_update_own_or_admin"
ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'payment-proofs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin_user()
  )
)
WITH
  CHECK (
    bucket_id = 'payment-proofs'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_admin_user()
    )
  );

CREATE POLICY "payment_proofs_delete_own_or_admin"
ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'payment-proofs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin_user()
  )
);
