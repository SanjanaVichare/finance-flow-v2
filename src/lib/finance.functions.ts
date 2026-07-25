import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- Company / membership ----------

export const getMyCompany = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Super admin impersonation takes precedence
    const { data: sa } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
    let companyId: string | null = null;
    if (sa) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: sess } = await supabaseAdmin
        .from("super_admin_sessions").select("company_id")
        .eq("super_admin_id", userId).is("ended_at", null).maybeSingle();
      if (sess) companyId = (sess.company_id as string | null) ?? null;
    }
    if (!companyId) {
      const { data: memberships } = await supabase
        .from("company_members").select("company_id").eq("user_id", userId).limit(1);
      if (!memberships || memberships.length === 0) return null;
      companyId = memberships[0].company_id;
    }
    const { data: company } = await supabase
      .from("companies").select("*").eq("id", companyId).maybeSingle();
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("company_id", companyId);
    return { company, roles: roles?.map((r) => r.role) ?? [] };
  });


// createCompany removed. Companies are provisioned only by Super Admin via
// superCreateCompany in src/lib/admin.functions.ts.


// ---------- Accounts ----------

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("accounts").select("*").eq("company_id", data.companyId).order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id?: string; companyId: string; name: string; type: string; openingBalance: number }) =>
    z.object({
      id: z.string().uuid().optional(),
      companyId: z.string().uuid(),
      name: z.string().trim().min(1).max(80),
      type: z.enum(["cash", "bank", "wallet", "upi", "credit_card"]),
      openingBalance: z.number(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("accounts").update({ name: data.name, type: data.type }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("accounts").insert({
        company_id: data.companyId, name: data.name, type: data.type,
        opening_balance: data.openingBalance, current_balance: data.openingBalance,
      }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Categories ----------

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("categories").select("*").eq("company_id", data.companyId).order("group").order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; name: string; group: "income" | "expense" }) =>
    z.object({
      companyId: z.string().uuid(),
      name: z.string().trim().min(1).max(60),
      group: z.enum(["income", "expense"]),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("categories").insert({ company_id: data.companyId, name: data.name, group: data.group });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Transactions ----------

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; from?: string; to?: string; limit?: number }) =>
    z.object({
      companyId: z.string().uuid(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("transactions")
      .select("*, category:categories(name, group), account:accounts!transactions_account_id_fkey(name)")
      .eq("company_id", data.companyId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.from) q = q.gte("occurred_on", data.from);
    if (data.to) q = q.lte("occurred_on", data.to);
    if (data.limit) q = q.limit(data.limit);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    companyId: string;
    accountId: string;
    toAccountId?: string | null;
    categoryId?: string | null;
    type: "income" | "expense" | "transfer";
    amount: number;
    description?: string;
    vendor?: string;
    paymentMethod: string;
    occurredOn: string;
  }) => z.object({
    companyId: z.string().uuid(),
    accountId: z.string().uuid(),
    toAccountId: z.string().uuid().nullish(),
    categoryId: z.string().uuid().nullish(),
    type: z.enum(["income", "expense", "transfer"]),
    amount: z.number().positive().max(1_000_000_000),
    description: z.string().max(500).optional(),
    vendor: z.string().max(120).optional(),
    paymentMethod: z.enum(["cash", "upi", "card", "bank", "other"]),
    occurredOn: z.string(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("transactions").insert({
      company_id: data.companyId,
      account_id: data.accountId,
      to_account_id: data.toAccountId ?? null,
      category_id: data.categoryId ?? null,
      user_id: userId,
      type: data.type,
      amount: data.amount,
      description: data.description ?? null,
      vendor: data.vendor ?? null,
      payment_method: data.paymentMethod,
      occurred_on: data.occurredOn,
    }).select().single();
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      company_id: data.companyId, user_id: userId, action: "transaction.create",
      table_name: "transactions", record_id: row.id, metadata: { amount: data.amount, type: data.type },
    });
    return row;
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; companyId: string }) =>
    z.object({ id: z.string().uuid(), companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("transactions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      company_id: data.companyId, user_id: context.userId, action: "transaction.delete",
      table_name: "transactions", record_id: data.id,
    });
    return { ok: true };
  });

// ---------- Budgets ----------

export const listBudgets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; month: string }) =>
    z.object({ companyId: z.string().uuid(), month: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: budgets, error } = await context.supabase
      .from("budgets")
      .select("*, category:categories(id, name, group)")
      .eq("company_id", data.companyId)
      .eq("month", data.month);
    if (error) throw new Error(error.message);

    // spent per category this month
    const monthStart = data.month;
    const d = new Date(monthStart);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    const { data: txns } = await context.supabase
      .from("transactions")
      .select("category_id, amount, type")
      .eq("company_id", data.companyId)
      .eq("type", "expense")
      .gte("occurred_on", monthStart)
      .lte("occurred_on", monthEnd);
    const spentMap = new Map<string, number>();
    (txns ?? []).forEach((t) => {
      if (!t.category_id) return;
      spentMap.set(t.category_id, (spentMap.get(t.category_id) ?? 0) + Number(t.amount));
    });
    return (budgets ?? []).map((b) => ({
      ...b,
      spent: spentMap.get(b.category_id) ?? 0,
    }));
  });

export const upsertBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; categoryId: string; month: string; monthlyLimit: number }) =>
    z.object({
      companyId: z.string().uuid(),
      categoryId: z.string().uuid(),
      month: z.string(),
      monthlyLimit: z.number().nonnegative(),
    }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("budgets")
      .upsert({
        company_id: data.companyId,
        category_id: data.categoryId,
        month: data.month,
        monthly_limit: data.monthlyLimit,
      }, { onConflict: "company_id,category_id,month" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Goals ----------

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("goals").select("*").eq("company_id", data.companyId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    id?: string; companyId: string; name: string; goalType: string;
    targetAmount: number; currentAmount: number; deadline?: string | null;
  }) => z.object({
    id: z.string().uuid().optional(),
    companyId: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    goalType: z.string().max(30),
    targetAmount: z.number().positive(),
    currentAmount: z.number().nonnegative(),
    deadline: z.string().nullish(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase.from("goals").update({
        name: data.name, goal_type: data.goalType,
        target_amount: data.targetAmount, current_amount: data.currentAmount,
        deadline: data.deadline ?? null,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase.from("goals").insert({
      company_id: data.companyId, name: data.name, goal_type: data.goalType,
      target_amount: data.targetAmount, current_amount: data.currentAmount,
      deadline: data.deadline ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("goals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Dashboard summary ----------

export const getDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const today = new Date();
    const isoToday = today.toISOString().slice(0, 10);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const yearStart = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);

    const { data: txns } = await supabase
      .from("transactions")
      .select("amount, type, occurred_on, category_id, category:categories(name)")
      .eq("company_id", data.companyId)
      .gte("occurred_on", yearStart);

    const list = txns ?? [];
    const num = (n: unknown) => Number(n ?? 0);

    let todayIncome = 0, todayExpense = 0, monthIncome = 0, monthExpense = 0;
    const byCategory = new Map<string, number>();
    const byMonth = new Map<string, { income: number; expense: number }>();

    for (const t of list) {
      const amt = num(t.amount);
      if (t.occurred_on === isoToday) {
        if (t.type === "income") todayIncome += amt;
        if (t.type === "expense") todayExpense += amt;
      }
      if (t.occurred_on >= monthStart) {
        if (t.type === "income") monthIncome += amt;
        if (t.type === "expense") monthExpense += amt;
      }
      if (t.type === "expense") {
        const catName = (t.category as unknown as { name?: string } | null)?.name ?? "Uncategorized";
        byCategory.set(catName, (byCategory.get(catName) ?? 0) + amt);
      }
      const monthKey = t.occurred_on.slice(0, 7);
      const bucket = byMonth.get(monthKey) ?? { income: 0, expense: 0 };
      if (t.type === "income") bucket.income += amt;
      if (t.type === "expense") bucket.expense += amt;
      byMonth.set(monthKey, bucket);
    }

    const { data: accounts } = await supabase
      .from("accounts").select("current_balance").eq("company_id", data.companyId);
    const netBalance = (accounts ?? []).reduce((sum, a) => sum + num(a.current_balance), 0);

    const { data: recent } = await supabase
      .from("transactions")
      .select("id, amount, type, occurred_on, description, vendor, category:categories(name), account:accounts!transactions_account_id_fkey(name)")
      .eq("company_id", data.companyId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8);

    return {
      todayIncome, todayExpense,
      monthIncome, monthExpense,
      profit: monthIncome - monthExpense,
      netBalance,
      categoryBreakdown: [...byCategory.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      monthlyTrend: [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, income: v.income, expense: v.expense })),
      recent: recent ?? [],
    };
  });
