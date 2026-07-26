CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID NOT NULL
        REFERENCES public.companies(id)
        ON DELETE CASCADE,

    sku TEXT,

    name TEXT NOT NULL,

    category TEXT,

    purchase_price NUMERIC(12,2),

    selling_price NUMERIC(12,2),

    stock INTEGER DEFAULT 0,

    created_by UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT now()
);