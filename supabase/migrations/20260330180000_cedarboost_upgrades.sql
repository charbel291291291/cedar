
-- 1. Promo Code System
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_percent numeric NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  expires_at timestamptz,
  usage_limit int DEFAULT 1,
  used_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Check if policy exists before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'promo_codes' AND policyname = 'Promo codes are viewable by authenticated users'
    ) THEN
        CREATE POLICY "Promo codes are viewable by authenticated users" ON public.promo_codes FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- Table to track usage per user to prevent abuse
CREATE TABLE IF NOT EXISTS public.promo_code_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at timestamptz DEFAULT now(),
  UNIQUE(promo_code_id, user_id)
);

ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'promo_code_usage' AND policyname = 'Users can see their own promo usage'
    ) THEN
        CREATE POLICY "Users can see their own promo usage" ON public.promo_code_usage FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- 2. Referral System
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by_id uuid REFERENCES auth.users(id);

-- Function to generate a referral code for new users
CREATE OR REPLACE FUNCTION generate_referral_code() RETURNS text AS $$
DECLARE
    new_code text;
    done bool;
BEGIN
    done := false;
    WHILE NOT done LOOP
        new_code := 'CEDAR-' || upper(substring(md5(random()::text) from 1 for 6));
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE referral_code = new_code) THEN
            done := true;
        END IF;
    END LOOP;
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing users with referral codes
UPDATE public.users SET referral_code = generate_referral_code() WHERE referral_code IS NULL;

-- Update handle_new_user to assign a referral code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, referral_code) 
  VALUES (NEW.id, NEW.email, generate_referral_code())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Table to track referrals
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending', -- pending, completed
  reward_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(referred_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'referrals' AND policyname = 'Users can see their referrals'
    ) THEN
        CREATE POLICY "Users can see their referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
    END IF;
END $$;

-- 3. Additional status for orders
-- The request mentions pending / processing / completed.
-- Our current orders already has 'pending' as default and 'paid' from place_wallet_order.
-- Let's ensure the status reflects the new workflow if needed.

-- Add index for orders for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- Enable Realtime for relevant tables if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
END $$;
