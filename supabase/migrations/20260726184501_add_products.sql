-- ============================================
-- DYNAMIC ENTITY SYSTEM (Extends existing entities)
-- ============================================

-- 1. Entity definitions - what types of records a company tracks
CREATE TABLE public.entity_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- "Students", "Employees", "Inventory Items"
    icon TEXT, -- emoji or icon name
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_definitions TO authenticated;
GRANT ALL ON public.entity_definitions TO service_role;

ALTER TABLE public.entity_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity_definitions_member_read"
    ON public.entity_definitions FOR SELECT
    USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "entity_definitions_admin_write"
    ON public.entity_definitions FOR ALL
    USING (public.is_company_manager_or_admin(auth.uid(), company_id))
    WITH CHECK (public.is_company_manager_or_admin(auth.uid(), company_id));

-- 2. Field definitions - dynamic columns per entity type
CREATE TABLE public.field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_definition_id UUID NOT NULL REFERENCES public.entity_definitions(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- "Student Name", "Roll Number", "Fees"
    field_key TEXT NOT NULL, -- "student_name", "roll_number", "fees"
    field_type TEXT NOT NULL CHECK (field_type IN (
        'text', 'number', 'currency', 'date', 'email', 'phone', 
        'boolean', 'dropdown', 'multi_select', 'textarea'
    )),
    is_required BOOLEAN NOT NULL DEFAULT false,
    is_unique BOOLEAN NOT NULL DEFAULT false,
    options JSONB, -- For dropdown/multi_select: ["Option 1", "Option 2"]
    default_value JSONB,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(entity_definition_id, field_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_definitions TO authenticated;
GRANT ALL ON public.field_definitions TO service_role;

ALTER TABLE public.field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "field_definitions_member_read"
    ON public.field_definitions FOR SELECT
    USING (public.is_company_member(auth.uid(), 
        (SELECT company_id FROM public.entity_definitions WHERE id = entity_definition_id)
    ));

CREATE POLICY "field_definitions_admin_write"
    ON public.field_definitions FOR ALL
    USING (public.is_company_manager_or_admin(auth.uid(),
        (SELECT company_id FROM public.entity_definitions WHERE id = entity_definition_id)
    ))
    WITH CHECK (public.is_company_manager_or_admin(auth.uid(),
        (SELECT company_id FROM public.entity_definitions WHERE id = entity_definition_id)
    ));

-- 3. Link existing entities to definitions
ALTER TABLE public.entities 
ADD COLUMN entity_definition_id UUID REFERENCES public.entity_definitions(id) ON DELETE SET NULL;

-- 4. Create default entity definitions for existing companies
-- This will be handled by a trigger or seed script

-- ============================================
-- ATTENDANCE SYSTEM (Works with any entity)
-- ============================================

CREATE TABLE public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'leave', 'half_day', 'holiday')),
    check_in_time TIME,
    check_out_time TIME,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(entity_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_member_read"
    ON public.attendance_records FOR SELECT
    USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "attendance_admin_write"
    ON public.attendance_records FOR ALL
    USING (public.is_company_manager_or_admin(auth.uid(), company_id))
    WITH CHECK (public.is_company_manager_or_admin(auth.uid(), company_id));

-- ============================================
-- PAYMENT RECORDS (Works with any entity)
-- ============================================

CREATE TABLE public.payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    due_date DATE,
    paid_date DATE,
    status TEXT NOT NULL CHECK (status IN ('paid', 'pending', 'overdue', 'partial')),
    payment_type TEXT NOT NULL CHECK (payment_type IN ('fee', 'salary', 'invoice', 'subscription', 'custom')),
    description TEXT,
    reference_id TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO authenticated;
GRANT ALL ON public.payment_records TO service_role;

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_member_read"
    ON public.payment_records FOR SELECT
    USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "payments_admin_write"
    ON public.payment_records FOR ALL
    USING (public.is_company_manager_or_admin(auth.uid(), company_id))
    WITH CHECK (public.is_company_manager_or_admin(auth.uid(), company_id));

-- ============================================
-- IMPORT/EXPORT HISTORY
-- ============================================

CREATE TABLE public.import_export_history (
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

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-create default entity definitions when company is created
CREATE OR REPLACE FUNCTION public.seed_default_entity_definitions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    employees_def_id UUID;
    students_def_id UUID;
BEGIN
    -- Create "Employees" entity definition
    INSERT INTO public.entity_definitions (company_id, name, icon)
    VALUES (NEW.id, 'Employees', '👤')
    RETURNING id INTO employees_def_id;

    -- Create fields for Employees
    INSERT INTO public.field_definitions (entity_definition_id, name, field_key, field_type, display_order)
    VALUES 
        (employees_def_id, 'Full Name', 'full_name', 'text', 0),
        (employees_def_id, 'Email', 'email', 'email', 1),
        (employees_def_id, 'Phone', 'phone', 'phone', 2),
        (employees_def_id, 'Department', 'department', 'dropdown', 3),
        (employees_def_id, 'Salary', 'salary', 'currency', 4),
        (employees_def_id, 'Joining Date', 'joining_date', 'date', 5),
        (employees_def_id, 'Status', 'status', 'dropdown', 6);

    -- Create "Students" entity definition
    INSERT INTO public.entity_definitions (company_id, name, icon)
    VALUES (NEW.id, 'Students', '🎓')
    RETURNING id INTO students_def_id;

    -- Create fields for Students
    INSERT INTO public.field_definitions (entity_definition_id, name, field_key, field_type, display_order)
    VALUES 
        (students_def_id, 'Full Name', 'full_name', 'text', 0),
        (students_def_id, 'Roll Number', 'roll_number', 'text', 1),
        (students_def_id, 'Class', 'class', 'dropdown', 2),
        (students_def_id, 'Fees', 'fees', 'currency', 3),
        (students_def_id, 'Guardian', 'guardian', 'text', 4),
        (students_def_id, 'Parent Phone', 'parent_phone', 'phone', 5),
        (students_def_id, 'Bus Route', 'bus_route', 'text', 6);

    RETURN NEW;
END; $$;

-- Drop existing trigger if it exists (from your earlier schema)
DROP TRIGGER IF EXISTS seed_default_categories_after_company_insert ON public.companies;

-- Create new trigger
CREATE TRIGGER seed_default_entity_definitions_after_company_insert
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.seed_default_entity_definitions();

-- Helper: Migrate existing entities to use definitions
CREATE OR REPLACE FUNCTION public.migrate_entities_to_definitions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    comp_record RECORD;
    def_record RECORD;
BEGIN
    FOR comp_record IN SELECT id FROM public.companies LOOP
        -- For each entity type, find or create definition
        FOR def_record IN 
            SELECT DISTINCT type FROM public.entities WHERE company_id = comp_record.id
        LOOP
            -- Get or create definition for this type
            WITH def AS (
                INSERT INTO public.entity_definitions (company_id, name, icon)
                VALUES (comp_record.id, initcap(def_record.type::text) || 's', 
                    CASE def_record.type
                        WHEN 'employee' THEN '👤'
                        WHEN 'student' THEN '🎓'
                        WHEN 'customer' THEN '🛒'
                        WHEN 'vendor' THEN '📦'
                        WHEN 'teacher' THEN '👨‍🏫'
                        ELSE '📋'
                    END)
                ON CONFLICT (company_id, name) DO NOTHING
                RETURNING id
            )
            SELECT id INTO def_record FROM def;
            
            -- Link entities to definition
            UPDATE public.entities 
            SET entity_definition_id = def_record 
            WHERE company_id = comp_record.id AND type = def_record.type;
        END LOOP;
    END LOOP;
END; $$;