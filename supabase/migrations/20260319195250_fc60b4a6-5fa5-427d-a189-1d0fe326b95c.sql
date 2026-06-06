
-- Add image_url column to services table
ALTER TABLE public.services ADD COLUMN image_url text;

-- Add a topup_transactions table for wallet top-ups
CREATE TABLE public.topup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  proof_image text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;

-- Users can create their own top-up requests
CREATE POLICY "Users can create topup requests"
  ON public.topup_requests FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own top-up requests
CREATE POLICY "Users can view own topup requests"
  ON public.topup_requests FOR SELECT TO public
  USING (auth.uid() = user_id);

-- Authenticated users can view all topup requests (admin)
CREATE POLICY "Admins can view all topup requests"
  ON public.topup_requests FOR SELECT TO authenticated
  USING (true);

-- Authenticated users can update topup requests (admin)
CREATE POLICY "Admins can update topup requests"
  ON public.topup_requests FOR UPDATE TO authenticated
  USING (true);
