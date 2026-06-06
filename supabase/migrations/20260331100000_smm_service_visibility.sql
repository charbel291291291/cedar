-- =============================================================
-- SMM SERVICE VISIBILITY CONTROLS
-- Adds is_active, show_in_popular, is_featured to smm_services
-- =============================================================

ALTER TABLE public.smm_services
  ADD COLUMN IF NOT EXISTS is_active       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_popular boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_url       text;

-- Indexes for fast filtered queries
CREATE INDEX IF NOT EXISTS idx_smm_services_active
  ON public.smm_services (is_active);

CREATE INDEX IF NOT EXISTS idx_smm_services_popular
  ON public.smm_services (is_active, show_in_popular);

CREATE INDEX IF NOT EXISTS idx_smm_services_featured
  ON public.smm_services (is_active, is_featured);

-- Allow admins to update visibility columns (service_role already has full access)
-- Regular users only need SELECT
GRANT SELECT ON public.smm_services TO authenticated;
