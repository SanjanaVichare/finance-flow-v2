import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Forbidden: super admin only");
}

// ---------- Impersonation ----------

export const getActiveImpersonation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sa } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
    if (!sa) return { isSuperAdmin: false, active: null as null | { companyId: string; companyName: string; startedAt: string } };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sess } = await supabaseAdmin
      .from("super_admin_sessions")
      .select("company_id, started_at, companies:company_id (name)")
      .eq("super_admin_id", userId).is("ended_at", null).maybeSingle();
    if (!sess) return { isSuperAdmin: true, active: null };
    const name = (sess as any).companies?.name ?? "Company";
    return {
      isSuperAdmin: true,
      active: { companyId: sess.company_id as string, companyName: name, startedAt: sess.started_at as string },
    };
  });

export const startImpersonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Upsert: one active session per super admin
    await supabaseAdmin.from("super_admin_sessions")
      .delete().eq("super_admin_id", context.userId);
    const { error } = await supabaseAdmin.from("super_admin_sessions").insert({
      super_admin_id: context.userId,
      company_id: data.companyId,
    });
    if (error) throw new Error(error.message);
    // Audit
    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId,
      user_id: context.userId,
      action: "super_admin.impersonation.start",
      table_name: "companies",
      record_id: data.companyId,
    }).then(() => null, () => null);
    return { ok: true };
  });

export const stopImpersonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sess } = await supabaseAdmin.from("super_admin_sessions")
      .select("company_id").eq("super_admin_id", context.userId).maybeSingle();
    await supabaseAdmin.from("super_admin_sessions")
      .delete().eq("super_admin_id", context.userId);
    if (sess) {
      await supabaseAdmin.from("audit_logs").insert({
        company_id: sess.company_id as string,
        user_id: context.userId,
        action: "super_admin.impersonation.stop",
        table_name: "companies",
        record_id: sess.company_id as string,
      }).then(() => null, () => null);
    }
    return { ok: true };
  });

// ---------- Platform stats & companies listing ----------

export const getPlatformStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [companiesRes, membersRes, txnRes] = await Promise.all([
      supabaseAdmin.from("companies").select("id, status, company_type, created_at"),
      supabaseAdmin.from("company_members").select("user_id"),
      supabaseAdmin.from("transactions").select("type, amount"),
    ]);
    const companies = companiesRes.data ?? [];
    const members = membersRes.data ?? [];
    const txns = txnRes.data ?? [];
    const totalIncome = txns.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const totalExpense = txns.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const activeUsers = new Set(members.map((m: any) => m.user_id)).size;
    return {
      totalCompanies: companies.length,
      activeCompanies: companies.filter((c: any) => c.status === "active").length,
      personalCompanies: companies.filter((c: any) => c.company_type === "personal").length,
      commercialCompanies: companies.filter((c: any) => c.company_type === "commercial").length,
      activeUsers,
      totalTransactions: txns.length,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
    };
  });

export const listCompaniesEnriched = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [companiesRes, membersRes, txnRes, adminRolesRes, profilesRes] = await Promise.all([
      supabaseAdmin.from("companies").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("company_members").select("company_id, user_id"),
      supabaseAdmin.from("transactions").select("company_id, type, amount"),
      supabaseAdmin.from("user_roles").select("user_id, company_id, role").eq("role", "company_admin"),
      supabaseAdmin.from("profiles").select("id, full_name, email"),
    ]);
    const companies = companiesRes.data ?? [];
    const members = membersRes.data ?? [];
    const txns = txnRes.data ?? [];
    const adminRoles = adminRolesRes.data ?? [];
    const profiles = profilesRes.data ?? [];
    const profileById = new Map(profiles.map((p: any) => [p.id, p]));
    const usersByCompany = new Map<string, Set<string>>();
    for (const m of members) {
      const set = usersByCompany.get(m.company_id) ?? new Set();
      set.add(m.user_id);
      usersByCompany.set(m.company_id, set);
    }
    const incomeByCompany = new Map<string, number>();
    const expenseByCompany = new Map<string, number>();
    for (const t of txns) {
      if (t.type === "income") incomeByCompany.set(t.company_id, (incomeByCompany.get(t.company_id) ?? 0) + Number(t.amount || 0));
      else if (t.type === "expense") expenseByCompany.set(t.company_id, (expenseByCompany.get(t.company_id) ?? 0) + Number(t.amount || 0));
    }
    const adminByCompany = new Map<string, any>();
    for (const r of adminRoles) {
      if (!r.company_id) continue;
      if (!adminByCompany.has(r.company_id)) adminByCompany.set(r.company_id, profileById.get(r.user_id));
    }
    return companies.map((c: any) => ({
      ...c,
      admin: adminByCompany.get(c.id) ?? null,
      activeUsers: usersByCompany.get(c.id)?.size ?? 0,
      totalIncome: incomeByCompany.get(c.id) ?? 0,
      totalExpense: expenseByCompany.get(c.id) ?? 0,
    }));
  });

export const listRecentActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("audit_logs")
      .select("id, action, table_name, record_id, company_id, user_id, created_at")
      .order("created_at", { ascending: false }).limit(100);
    return data ?? [];
  });
