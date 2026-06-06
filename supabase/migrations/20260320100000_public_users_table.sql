-- App expects public.users for balance (see Dashboard, Admin top-up approval).
-- If public.profiles exists (older schema), copy rows once; otherwise skip.

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  balance numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user row"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own user row"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    INSERT INTO public.users (id, email, balance, created_at)
    SELECT id, email, COALESCE(balance, 0), created_at
    FROM public.profiles
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
  END IF;

  INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
