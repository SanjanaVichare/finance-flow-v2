-- Add entity_definition_id column to entities
ALTER TABLE public.entities 
ADD COLUMN IF NOT EXISTS entity_definition_id UUID REFERENCES public.entity_definitions(id) ON DELETE SET NULL;

-- Create default entity definitions for existing companies
INSERT INTO public.entity_definitions (company_id, name, icon)
SELECT 
  c.id,
  'Employees',
  '👤'
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.entity_definitions ed WHERE ed.company_id = c.id AND ed.name = 'Employees'
);

INSERT INTO public.entity_definitions (company_id, name, icon)
SELECT 
  c.id,
  'Students',
  '🎓'
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.entity_definitions ed WHERE ed.company_id = c.id AND ed.name = 'Students'
);

-- Link existing entities to definitions
UPDATE public.entities e
SET entity_definition_id = ed.id
FROM public.entity_definitions ed
WHERE e.company_id = ed.company_id 
  AND ed.name = CASE 
    WHEN e.type = 'employee' THEN 'Employees'
    WHEN e.type = 'student' THEN 'Students'
    WHEN e.type = 'customer' THEN 'Customers'
    WHEN e.type = 'vendor' THEN 'Vendors'
    ELSE 'Employees'
  END;