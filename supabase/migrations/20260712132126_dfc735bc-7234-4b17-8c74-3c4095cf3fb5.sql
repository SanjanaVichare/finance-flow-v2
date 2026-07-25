
-- Add first-login and status fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_reset_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email text;

-- Add gst_vat to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS gst_vat text;

-- Update handle_new_user to mark admin-created users as needing password reset,
-- based on user_metadata.must_reset_password (set by admin.createUser call).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, must_reset_password)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    COALESCE((NEW.raw_user_meta_data->>'must_reset_password')::boolean, false)
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- Helper: promote a user (by email) to super_admin. Developer runs this once
-- via SQL to seed the first Super Admin. NOT exposed to any UI.
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No auth user found with email %', _email;
  END IF;
  INSERT INTO public.user_roles (user_id, role, company_id)
  VALUES (_uid, 'super_admin', NULL)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.profiles (id, full_name, email, must_reset_password)
  VALUES (_uid, _email, _email, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_super_admin(text) FROM public, anon, authenticated;
