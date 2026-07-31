CREATE TABLE IF NOT EXISTS public.import_export_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    operation TEXT NOT NULL CHECK (operation IN ('import', 'export')),
    entity_definition_id UUID REFERENCES public.entity_definitions(id) ON DELETE SET NULL,
    file_name TEXT,
    rows_processed INTEGER,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'processing')),
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.import_export_history TO authenticated;
GRANT ALL ON public.import_export_history TO service_role;

ALTER TABLE public.import_export_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_export_member_read"
    ON public.import_export_history FOR SELECT
    USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "import_export_member_insert"
    ON public.import_export_history FOR INSERT
    WITH CHECK (public.is_company_member(auth.uid(), company_id));