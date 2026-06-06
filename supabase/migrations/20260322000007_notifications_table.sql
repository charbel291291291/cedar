-- Persistent notifications table.
-- Notifications are created by DB triggers (SECURITY DEFINER) when order/topup
-- statuses change — so they are stored even when the user is offline.
-- Users can read, mark-read, and delete their own notifications via RLS.

-- ─── 1) Table ───
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       text        NOT NULL CHECK (type IN ('order', 'topup')),
  message    text        NOT NULL,
  status     text        NOT NULL,
  read       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── 2) RLS ───
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users read own notifications
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users mark own notifications as read (UPDATE read only)
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users delete own notifications (clear all)
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ─── 3) Realtime (INSERT events streamed to subscribed clients) ───
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ─── 4) Trigger: order status changes → insert notification ───
CREATE OR REPLACE FUNCTION public.notify_user_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg text;
BEGIN
  -- Skip if status did not actually change
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  msg := CASE NEW.status
    WHEN 'pending_payment_review' THEN 'Your order is under payment review'
    WHEN 'paid'                   THEN 'Your payment has been confirmed ✓'
    WHEN 'processing'             THEN 'Your order is being processed…'
    WHEN 'completed'              THEN '🎉 Your recharge is complete!'
    WHEN 'rejected'               THEN 'Your order has been rejected'
    WHEN 'failed'                 THEN 'Your order could not be processed'
    ELSE 'Order updated to ' || NEW.status
  END;

  INSERT INTO public.notifications (user_id, type, message, status)
  VALUES (NEW.user_id, 'order', msg, NEW.status);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_notify_user ON public.orders;
CREATE TRIGGER orders_notify_user
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_user_order_status();

-- ─── 5) Trigger: topup status changes → insert notification ───
CREATE OR REPLACE FUNCTION public.notify_user_topup_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg text;
BEGIN
  -- Skip if status did not change
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Only notify on terminal statuses users care about
  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  msg := CASE NEW.status
    WHEN 'approved' THEN '💰 Top-up approved! Balance has been credited.'
    WHEN 'rejected' THEN 'Your top-up request was rejected'
    ELSE 'Top-up ' || NEW.status
  END;

  INSERT INTO public.notifications (user_id, type, message, status)
  VALUES (NEW.user_id, 'topup', msg, NEW.status);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS topups_notify_user ON public.topup_requests;
CREATE TRIGGER topups_notify_user
  AFTER UPDATE OF status ON public.topup_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_user_topup_status();
