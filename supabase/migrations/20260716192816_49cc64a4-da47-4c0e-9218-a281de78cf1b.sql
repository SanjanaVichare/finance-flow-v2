
-- 1. Company type enum + column
DO $$ BEGIN
  CREATE TYPE public.company_type AS ENUM ('personal', 'commercial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS company_type public.company_type NOT NULL DEFAULT 'commercial';

-- 2. Super admin impersonation sessions
CREATE TABLE IF NOT EXISTS public.super_admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  UNIQUE (super_admin_id) -- one active/last session per super admin; upsert on switch
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_admin_sessions TO authenticated;
GRANT ALL ON public.super_admin_sessions TO service_role;

ALTER TABLE public.super_admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage own impersonation session"
  ON public.super_admin_sessions
  FOR ALL
  USING (super_admin_id = auth.uid() AND public.is_super_admin(auth.uid()))
  WITH CHECK (super_admin_id = auth.uid() AND public.is_super_admin(auth.uid()));

-- 3. Effective company helper
CREATE OR REPLACE FUNCTION public.effective_company_id(_user uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT company_id FROM public.super_admin_sessions
      WHERE super_admin_id = _user AND ended_at IS NULL LIMIT 1),
    (SELECT company_id FROM public.company_members
      WHERE user_id = _user ORDER BY company_id LIMIT 1)
  );
$$;
