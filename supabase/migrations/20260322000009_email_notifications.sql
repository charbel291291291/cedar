-- ─── Email Notification Infrastructure ───────────────────────────────────────
-- 1. Enable pg_net (available on all Supabase projects)
-- 2. Seed default app_settings rows used by the trigger
-- 3. Lock down app_settings with RLS (webhook_secret is admin-only)
-- 4. Create trigger that POSTs to send-notification-email edge function

-- Enable pg_net so DB triggers can make HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- ─── Default app_settings rows ────────────────────────────────────────────────
-- Admin sets these via the Admin → Platform Settings panel.
-- supabase_project_url : e.g. https://abcxyz.supabase.co  (no trailing slash)
-- webhook_secret       : any long random string, must match WEBHOOK_SECRET secret
-- email_from           : "Name <address>" format accepted by Resend
INSERT INTO public.app_settings (key, value, updated_at) VALUES
  ('supabase_project_url', '', now()),
  ('webhook_secret',       '', now()),
  ('email_from',           'Charbel Card <noreply@charbelcard.com>', now())
ON CONFLICT (key) DO NOTHING;

-- ─── RLS on app_settings ──────────────────────────────────────────────────────
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Regular users may only read the wallet address (needed for top-up flow)
CREATE POLICY "app_settings_user_read_wallet" ON public.app_settings
  FOR SELECT TO authenticated
  USING (key = 'usdt_wallet_address');

-- Admins can read and write every row
CREATE POLICY "app_settings_admin_all" ON public.app_settings
  FOR ALL TO authenticated
  USING  (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ─── Trigger: call edge function on every new notification ────────────────────
CREATE OR REPLACE FUNCTION public.trigger_notification_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  -- Read config from app_settings (set by admin via UI)
  SELECT value INTO v_url    FROM public.app_settings WHERE key = 'supabase_project_url';
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'webhook_secret';

  -- Skip gracefully if not configured yet
  IF v_url IS NULL OR v_url = '' THEN
    RETURN NEW;
  END IF;

  -- Fire-and-forget HTTP POST to the edge function
  PERFORM extensions.net.http_post(
    url     := v_url || '/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', COALESCE(v_secret, '')
    ),
    body    := jsonb_build_object(
      'type',   'INSERT',
      'table',  'notifications',
      'record', to_jsonb(NEW)
    )
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to the notifications table
DROP TRIGGER IF EXISTS notifications_email_trigger ON public.notifications;
CREATE TRIGGER notifications_email_trigger
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notification_email();
