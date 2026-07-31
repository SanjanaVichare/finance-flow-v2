-- ============================================
-- ATTENDANCE TRACKING SYSTEM (Idempotent)
-- ============================================

-- 1. Create attendance_records table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'attendance_records') THEN
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
        
        -- Enable RLS
        ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
        
        -- Grant permissions
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
        GRANT ALL ON public.attendance_records TO service_role;
    END IF;
END $$;

-- 2. Drop existing policies if they exist (safe approach)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "attendance_member_read" ON public.attendance_records;
    DROP POLICY IF EXISTS "attendance_admin_write" ON public.attendance_records;
    DROP POLICY IF EXISTS "attendance_member_insert" ON public.attendance_records;
    DROP POLICY IF EXISTS "attendance_member_update" ON public.attendance_records;
    DROP POLICY IF EXISTS "attendance_member_delete" ON public.attendance_records;
END $$;

-- 3. Create RLS Policies
CREATE POLICY "attendance_member_read"
    ON public.attendance_records FOR SELECT
    USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "attendance_admin_write"
    ON public.attendance_records FOR ALL
    USING (public.is_company_manager_or_admin(auth.uid(), company_id))
    WITH CHECK (public.is_company_manager_or_admin(auth.uid(), company_id));

-- 4. Create indexes if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_attendance_entity_date') THEN
        CREATE INDEX idx_attendance_entity_date ON public.attendance_records(entity_id, date);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_attendance_company_date') THEN
        CREATE INDEX idx_attendance_company_date ON public.attendance_records(company_id, date);
    END IF;
END $$;