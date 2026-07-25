
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'company_admin', 'manager', 'employee');
CREATE TYPE public.account_type AS ENUM ('cash', 'bank', 'wallet', 'upi', 'credit_card');
CREATE TYPE public.category_group AS ENUM ('income', 'expense');
CREATE TYPE public.txn_type AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE public.payment_method AS ENUM ('cash', 'upi', 'card', 'bank', 'other');
CREATE TYPE public.company_status AS ENUM ('active', 'suspended');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  logo_url TEXT,
  address TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  status public.company_status NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ============ COMPANY MEMBERS ============
CREATE TABLE public.company_members (
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.is_super_admin(_user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(_user UUID, _company UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE user_id = _user AND company_id = _company)
    OR public.is_super_admin(_user)
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(_user UUID, _company UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user AND company_id = _company AND role = _role
  ) OR public.is_super_admin(_user)
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(_user UUID, _company UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_company_role(_user, _company, 'company_admin')
$$;

CREATE OR REPLACE FUNCTION public.is_company_manager_or_admin(_user UUID, _company UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_company_role(_user, _company, 'company_admin')
      OR public.has_company_role(_user, _company, 'manager')
$$;

-- companies RLS (now that helpers exist)
CREATE POLICY "companies_member_read" ON public.companies FOR SELECT
  USING (public.is_company_member(auth.uid(), id));
CREATE POLICY "companies_insert_any_auth" ON public.companies FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "companies_admin_update" ON public.companies FOR UPDATE
  USING (public.is_company_admin(auth.uid(), id));
CREATE POLICY "companies_super_delete" ON public.companies FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- company_members RLS
CREATE POLICY "members_read_own_company" ON public.company_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_company_admin(auth.uid(), company_id));
CREATE POLICY "members_self_insert" ON public.company_members FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_company_admin(auth.uid(), company_id));
CREATE POLICY "members_admin_delete" ON public.company_members FOR DELETE
  USING (public.is_company_admin(auth.uid(), company_id) OR user_id = auth.uid());

-- user_roles RLS
CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR (company_id IS NOT NULL AND public.is_company_admin(auth.uid(), company_id)));

-- ============ ACCOUNTS ============
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.account_type NOT NULL,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_member_read" ON public.accounts FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "accounts_admin_write" ON public.accounts FOR ALL
  USING (public.is_company_manager_or_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_manager_or_admin(auth.uid(), company_id));

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "group" public.category_group NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name, "group")
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_member_read" ON public.categories FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "categories_admin_write" ON public.categories FOR ALL
  USING (public.is_company_manager_or_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_manager_or_admin(auth.uid(), company_id));

-- ============ TRANSACTIONS ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_account_id UUID REFERENCES public.accounts(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.txn_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  vendor TEXT,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  attachment_url TEXT,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_company_date ON public.transactions(company_id, occurred_on DESC);
CREATE INDEX idx_txn_account ON public.transactions(account_id);
CREATE INDEX idx_txn_category ON public.transactions(category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "txn_member_read" ON public.transactions FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "txn_member_insert" ON public.transactions FOR INSERT
  WITH CHECK (public.is_company_member(auth.uid(), company_id) AND user_id = auth.uid());
CREATE POLICY "txn_own_or_admin_update" ON public.transactions FOR UPDATE
  USING (user_id = auth.uid() OR public.is_company_manager_or_admin(auth.uid(), company_id));
CREATE POLICY "txn_own_or_admin_delete" ON public.transactions FOR DELETE
  USING (user_id = auth.uid() OR public.is_company_manager_or_admin(auth.uid(), company_id));

-- ============ BUDGETS ============
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  monthly_limit NUMERIC(14,2) NOT NULL CHECK (monthly_limit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, category_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets_member_read" ON public.budgets FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "budgets_admin_write" ON public.budgets FOR ALL
  USING (public.is_company_manager_or_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_manager_or_admin(auth.uid(), company_id));

-- ============ GOALS ============
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal_type TEXT NOT NULL DEFAULT 'saving',
  target_amount NUMERIC(14,2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals_member_read" ON public.goals FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "goals_admin_write" ON public.goals FOR ALL
  USING (public.is_company_manager_or_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_manager_or_admin(auth.uid(), company_id));

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_self" ON public.notifications FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_read" ON public.audit_logs FOR SELECT
  USING (public.is_company_admin(auth.uid(), company_id));
CREATE POLICY "audit_member_insert" ON public.audit_logs FOR INSERT
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

-- ============ INVITATIONS ============
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'employee',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invites_admin_manage" ON public.invitations FOR ALL
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));

-- ============ TRIGGERS ============

-- profile auto-create on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- seed default categories on company create
CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.categories (company_id, name, "group") VALUES
    (NEW.id, 'Salary', 'income'),
    (NEW.id, 'Sales', 'income'),
    (NEW.id, 'Investment', 'income'),
    (NEW.id, 'Refund', 'income'),
    (NEW.id, 'Other Income', 'income'),
    (NEW.id, 'Rent', 'expense'),
    (NEW.id, 'Utilities', 'expense'),
    (NEW.id, 'Food', 'expense'),
    (NEW.id, 'Travel', 'expense'),
    (NEW.id, 'Fuel', 'expense'),
    (NEW.id, 'Marketing', 'expense'),
    (NEW.id, 'Office Supplies', 'expense'),
    (NEW.id, 'Healthcare', 'expense'),
    (NEW.id, 'Entertainment', 'expense'),
    (NEW.id, 'Shopping', 'expense'),
    (NEW.id, 'Business', 'expense'),
    (NEW.id, 'Other Expense', 'expense');
  RETURN NEW;
END; $$;
CREATE TRIGGER seed_categories_after_company_insert
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.seed_default_categories();

-- update account balance on transaction changes
CREATE OR REPLACE FUNCTION public.apply_txn_to_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sign_from NUMERIC := 0;
  sign_to NUMERIC := 0;
BEGIN
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE') THEN
    IF NEW.type = 'income' THEN sign_from := NEW.amount;
    ELSIF NEW.type = 'expense' THEN sign_from := -NEW.amount;
    ELSIF NEW.type = 'transfer' THEN sign_from := -NEW.amount; sign_to := NEW.amount;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    UPDATE public.accounts SET current_balance = current_balance + sign_from WHERE id = NEW.account_id;
    IF NEW.to_account_id IS NOT NULL THEN
      UPDATE public.accounts SET current_balance = current_balance + sign_to WHERE id = NEW.to_account_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'income' THEN
      UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'transfer' THEN
      UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
      IF OLD.to_account_id IS NOT NULL THEN
        UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.to_account_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- reverse old
    IF OLD.type = 'income' THEN
      UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'transfer' THEN
      UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
      IF OLD.to_account_id IS NOT NULL THEN
        UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.to_account_id;
      END IF;
    END IF;
    -- apply new
    UPDATE public.accounts SET current_balance = current_balance + sign_from WHERE id = NEW.account_id;
    IF NEW.to_account_id IS NOT NULL THEN
      UPDATE public.accounts SET current_balance = current_balance + sign_to WHERE id = NEW.to_account_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER txn_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_txn_to_balance();

-- account opening balance -> current
CREATE OR REPLACE FUNCTION public.init_account_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.current_balance = 0 AND NEW.opening_balance <> 0 THEN
    NEW.current_balance := NEW.opening_balance;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER init_account_balance_before_insert
BEFORE INSERT ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.init_account_balance();
