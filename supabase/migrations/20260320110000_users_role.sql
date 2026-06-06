-- Role for admin-only routes (see AdminRoute.tsx). Default keeps existing users non-admin.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

COMMENT ON COLUMN public.users.role IS 'application role: user | admin';
