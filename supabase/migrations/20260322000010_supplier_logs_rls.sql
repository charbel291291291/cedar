-- ─── RLS for supplier_logs ────────────────────────────────────────────────────
-- Supplier logs may contain internal API credentials/payloads.
-- Only admins should be able to query them.
-- The edge function (supplier-proxy) inserts via the service role key,
-- which bypasses RLS entirely — so no INSERT policy is needed here.

ALTER TABLE public.supplier_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_logs' AND policyname = 'supplier_logs_admin_select'
  ) THEN
    CREATE POLICY "supplier_logs_admin_select" ON public.supplier_logs
      FOR SELECT TO authenticated
      USING (public.is_admin_user());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_logs' AND policyname = 'supplier_logs_admin_delete'
  ) THEN
    CREATE POLICY "supplier_logs_admin_delete" ON public.supplier_logs
      FOR DELETE TO authenticated
      USING (public.is_admin_user());
  END IF;
END $$;
