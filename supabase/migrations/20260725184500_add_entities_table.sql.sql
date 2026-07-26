-- ===========================
-- PEOPLE / BUSINESS RECORDS
-- ===========================

CREATE TYPE public.entity_type AS ENUM (
  'employee',
  'student',
  'customer',
  'vendor',
  'teacher'
);

CREATE TABLE public.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id UUID NOT NULL
    REFERENCES public.companies(id)
    ON DELETE CASCADE,

  user_id UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  type public.entity_type NOT NULL,

  name TEXT NOT NULL,

  email TEXT,

  phone TEXT,

  code TEXT,

  department TEXT,

  class_name TEXT,

  notes TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  is_active BOOLEAN NOT NULL DEFAULT true,

  created_by UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entities_company
ON public.entities(company_id);

CREATE INDEX idx_entities_type
ON public.entities(type);

CREATE INDEX idx_entities_company_type
ON public.entities(company_id, type);

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.entities
TO authenticated;

GRANT ALL
ON public.entities
TO service_role;

ALTER TABLE public.entities
ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entities_member_read"
ON public.entities
FOR SELECT
USING (
    public.is_company_member(auth.uid(), company_id)
);

CREATE POLICY "entities_admin_write"
ON public.entities
FOR ALL
USING (
    public.is_company_manager_or_admin(auth.uid(), company_id)
)
WITH CHECK (
    public.is_company_manager_or_admin(auth.uid(), company_id)
);

