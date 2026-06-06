-- Run in Supabase SQL Editor (replace with your email or user UUID from Authentication → Users).
-- Requires public.users row for that user (sign in once after migrations that create users).

UPDATE public.users
SET role = 'admin'
WHERE id = 'PASTE_YOUR_USER_UUID_HERE';

-- Or by email if your users table stores email:
-- UPDATE public.users SET role = 'admin' WHERE email = 'you@example.com';
