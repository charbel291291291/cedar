-- =============================================================
-- VIP TIER SYSTEM
-- Levels 1-10, progression by total_spent, auto discount
-- =============================================================

-- ── 1. Extend users table ─────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS vip_level   int     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_spent numeric NOT NULL DEFAULT 0;

-- ── 2. VIP config table (admin-editable thresholds & discounts) ─
CREATE TABLE IF NOT EXISTS public.vip_config (
  level            int     PRIMARY KEY,
  label            text    NOT NULL,
  min_spent        numeric NOT NULL,
  discount_percent numeric NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 25),
  color            text    NOT NULL,
  created_at       timestamptz DEFAULT now()
);

-- RLS: authenticated users can read, only service_role can write
ALTER TABLE public.vip_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vip_config' AND policyname='vip_config_read') THEN
    CREATE POLICY vip_config_read ON public.vip_config FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ── 3. Seed default VIP tiers ─────────────────────────────────
INSERT INTO public.vip_config (level, label, min_spent, discount_percent, color) VALUES
  (1,  'Bronze I',    0,     0,    '#9CA3AF'),
  (2,  'Bronze II',   50,    2,    '#6B7280'),
  (3,  'Silver I',    120,   4,    '#93C5FD'),
  (4,  'Silver II',   250,   6,    '#60A5FA'),
  (5,  'Gold I',      450,   8,    '#A78BFA'),
  (6,  'Gold II',     700,   10,   '#8B5CF6'),
  (7,  'Platinum I',  1000,  12,   '#FCD34D'),
  (8,  'Platinum II', 1500,  14,   '#F59E0B'),
  (9,  'Diamond',     2500,  17,   '#F97316'),
  (10, 'Elite',       5000,  20,   '#EC4899')
ON CONFLICT (level) DO NOTHING;

-- ── 4. get_vip_stats() — user-facing stats ────────────────────
CREATE OR REPLACE FUNCTION public.get_vip_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_level        int;
  v_total_spent  numeric;
  v_cfg          record;
  v_next_cfg     record;
  v_discount     numeric;
BEGIN
  SELECT vip_level, total_spent INTO v_level, v_total_spent
    FROM users WHERE id = v_uid;

  SELECT * INTO v_cfg FROM vip_config WHERE level = v_level;

  SELECT * INTO v_next_cfg FROM vip_config
   WHERE level = v_level + 1
   ORDER BY level LIMIT 1;

  v_discount := COALESCE(v_cfg.discount_percent, 0);

  RETURN jsonb_build_object(
    'level',           v_level,
    'label',           COALESCE(v_cfg.label, 'Bronze I'),
    'color',           COALESCE(v_cfg.color, '#9CA3AF'),
    'discount',        v_discount,
    'total_spent',     COALESCE(v_total_spent, 0),
    'next_level',      CASE WHEN v_next_cfg IS NULL THEN NULL ELSE v_level + 1 END,
    'next_label',      v_next_cfg.label,
    'next_min_spent',  v_next_cfg.min_spent,
    'next_discount',   v_next_cfg.discount_percent,
    'spent_to_next',   GREATEST(0, COALESCE(v_next_cfg.min_spent, 0) - COALESCE(v_total_spent, 0))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vip_stats() TO authenticated;

-- ── 5. recalculate_vip(user_id) — called after each order ────
CREATE OR REPLACE FUNCTION public.recalculate_vip(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spent  numeric;
  v_level  int;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_spent
    FROM transactions
   WHERE user_id = p_user_id
     AND direction = 'debit'
     AND status = 'completed';

  SELECT COALESCE(MAX(level), 1) INTO v_level
    FROM vip_config
   WHERE min_spent <= v_spent;

  UPDATE users
     SET total_spent = v_spent,
         vip_level   = v_level
   WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_vip(uuid) TO service_role;

-- ── 6. Admin: set_user_vip(user_id, level) ───────────────────
CREATE OR REPLACE FUNCTION public.admin_set_vip(
  p_user_id uuid,
  p_level   int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_level < 1 OR p_level > 10 THEN
    RAISE EXCEPTION 'invalid_level';
  END IF;

  UPDATE users SET vip_level = p_level WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_vip(uuid, int) TO authenticated;

-- ── 7. Trigger: recalculate VIP after every completed debit tx ─
CREATE OR REPLACE FUNCTION public._trigger_recalculate_vip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direction = 'debit' AND NEW.status = 'completed' THEN
    PERFORM public.recalculate_vip(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_vip ON public.transactions;
CREATE TRIGGER trg_recalculate_vip
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public._trigger_recalculate_vip();

-- ── 8. Backfill existing users' total_spent + vip_level ───────
DO $$
DECLARE
  r RECORD;
  v_spent numeric;
  v_level int;
BEGIN
  FOR r IN SELECT id FROM users LOOP
    SELECT COALESCE(SUM(amount), 0) INTO v_spent
      FROM transactions
     WHERE user_id = r.id AND direction = 'debit' AND status = 'completed';

    SELECT COALESCE(MAX(level), 1) INTO v_level
      FROM vip_config
     WHERE min_spent <= v_spent;

    UPDATE users SET total_spent = v_spent, vip_level = v_level WHERE id = r.id;
  END LOOP;
END;
$$;
