-- 1. Create entity_definitions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.entity_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, name)
);

-- 2. Create field_definitions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_definition_id UUID NOT NULL REFERENCES public.entity_definitions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    field_key TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'currency', 'date', 'email', 'phone', 'boolean', 'dropdown', 'multi_select', 'textarea')),
    is_required BOOLEAN NOT NULL DEFAULT false,
    is_unique BOOLEAN NOT NULL DEFAULT false,
    options JSONB,
    default_value JSONB,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(entity_definition_id, field_key)
);

-- 3. Add entity_definition_id to entities if not exists
ALTER TABLE public.entities 
ADD COLUMN IF NOT EXISTS entity_definition_id UUID REFERENCES public.entity_definitions(id) ON DELETE SET NULL;

-- 4. Create default entity definitions for each company
INSERT INTO public.entity_definitions (company_id, name, icon)
SELECT 
    c.id,
    'Employees',
    '👤'
FROM public.companies c
WHERE NOT EXISTS (
    SELECT 1 FROM public.entity_definitions ed 
    WHERE ed.company_id = c.id AND ed.name = 'Employees'
);

INSERT INTO public.entity_definitions (company_id, name, icon)
SELECT 
    c.id,
    'Students',
    '🎓'
FROM public.companies c
WHERE NOT EXISTS (
    SELECT 1 FROM public.entity_definitions ed 
    WHERE ed.company_id = c.id AND ed.name = 'Students'
);

-- 5. Link existing entities to definitions
UPDATE public.entities e
SET entity_definition_id = ed.id
FROM public.entity_definitions ed
WHERE e.company_id = ed.company_id 
  AND ed.name = CASE 
    WHEN e.type = 'employee' THEN 'Employees'
    WHEN e.type = 'student' THEN 'Students'
    WHEN e.type = 'customer' THEN 'Customers'
    WHEN e.type = 'vendor' THEN 'Vendors'
    WHEN e.type = 'teacher' THEN 'Teachers'
    ELSE 'Employees'
  END
  AND e.entity_definition_id IS NULL;

-- 6. Create field definitions for Employees
WITH emp_def AS (
    SELECT id FROM public.entity_definitions WHERE name = 'Employees' LIMIT 1
)
INSERT INTO public.field_definitions (entity_definition_id, name, field_key, field_type, display_order)
SELECT 
    emp_def.id,
    field_name,
    field_key,
    field_type,
    display_order
FROM emp_def,
(VALUES 
    ('Full Name', 'full_name', 'text', 0),
    ('Email', 'email', 'email', 1),
    ('Phone', 'phone', 'phone', 2),
    ('Department', 'department', 'dropdown', 3),
    ('Position', 'position', 'text', 4),
    ('Salary', 'salary', 'currency', 5),
    ('Joining Date', 'joining_date', 'date', 6),
    ('Status', 'status', 'dropdown', 7)
) AS fields(field_name, field_key, field_type, display_order)
WHERE NOT EXISTS (
    SELECT 1 FROM public.field_definitions fd 
    WHERE fd.entity_definition_id = emp_def.id AND fd.field_key = fields.field_key
);

-- 7. Create field definitions for Students
WITH stu_def AS (
    SELECT id FROM public.entity_definitions WHERE name = 'Students' LIMIT 1
)
INSERT INTO public.field_definitions (entity_definition_id, name, field_key, field_type, display_order)
SELECT 
    stu_def.id,
    field_name,
    field_key,
    field_type,
    display_order
FROM stu_def,
(VALUES 
    ('Full Name', 'full_name', 'text', 0),
    ('Roll Number', 'roll_number', 'text', 1),
    ('Class', 'class', 'dropdown', 2),
    ('Fees', 'fees', 'currency', 3),
    ('Guardian', 'guardian', 'text', 4),
    ('Parent Phone', 'parent_phone', 'phone', 5),
    ('Bus Route', 'bus_route', 'text', 6),
    ('Status', 'status', 'dropdown', 7)
) AS fields(field_name, field_key, field_type, display_order)
WHERE NOT EXISTS (
    SELECT 1 FROM public.field_definitions fd 
    WHERE fd.entity_definition_id = stu_def.id AND fd.field_key = fields.field_key
);

-- 8. Verify
SELECT id, name FROM public.entity_definitions;