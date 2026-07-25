import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------------- helpers ----------------

function generateTempPassword(len = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const nums = "23456789";
  const syms = "!@#$%^&*?-_=+";
  const all = upper + lower + nums + syms;
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const pick = (set: string, i: number) => set[bytes[i] % set.length];
  const required = [pick(upper, 0), pick(lower, 1), pick(nums, 2), pick(syms, 3)];
  const rest = Array.from({ length: len - 4 }, (_, i) => pick(all, i + 4));
  const arr = [...required, ...rest];
  // Fisher–Yates shuffle with fresh randomness
  const shuffle = new Uint8Array(arr.length);
  crypto.getRandomValues(shuffle);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = shuffle[i] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Forbidden: super admin only");
}

async function assertCompanyAdmin(supabase: any, userId: string, companyId: string) {
  const { data: sa } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (sa) return;
  const { data } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("company_id", companyId).eq("role", "company_admin").maybeSingle();
  if (!data) throw new Error("Forbidden: company admin only");
}

// ---------------- profile / self ----------------

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id, full_name, email, phone, must_reset_password, is_active")
      .eq("id", userId).maybeSingle();
    const { data: roles } = await supabase
      .from("user_roles").select("role, company_id").eq("user_id", userId);
    const isSuperAdmin = (roles ?? []).some((r: any) => r.role === "super_admin");
    return { profile, roles: roles ?? [], isSuperAdmin };
  });

export const completeFirstLoginReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { newPassword: string }) =>
    z.object({ newPassword: z.string().min(8).max(128) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.newPassword,
      user_metadata: { must_reset_password: false },
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_reset_password: false }).eq("id", userId);
    return { ok: true };
  });

// ---------------- super admin: companies ----------------

export const listAllCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("companies").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

export const superCreateCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    company: {
      name: string; email?: string; phone?: string; address?: string;
      currency: string; timezone: string; gst_vat?: string; logo_url?: string;
      company_type?: "personal" | "commercial";
    };
    admin: { full_name: string; email: string; phone?: string };
  }) => z.object({
    company: z.object({
      name: z.string().trim().min(1).max(120),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().max(40).optional(),
      address: z.string().max(500).optional(),
      currency: z.string().trim().min(1).max(8),
      timezone: z.string().trim().min(1).max(60),
      gst_vat: z.string().max(60).optional(),
      logo_url: z.string().url().optional().or(z.literal("")),
      company_type: z.enum(["personal", "commercial"]).optional(),
    }),
    admin: z.object({
      full_name: z.string().trim().min(1).max(120),
      email: z.string().email(),
      phone: z.string().max(40).optional(),
    }),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create company
    const { data: company, error: cErr } = await supabaseAdmin
      .from("companies").insert({
        name: data.company.name,
        email: data.company.email || null,
        phone: data.company.phone || null,
        address: data.company.address || null,
        currency: data.company.currency,
        timezone: data.company.timezone,
        gst_vat: data.company.gst_vat || null,
        logo_url: data.company.logo_url || null,
        company_type: data.company.company_type ?? "commercial",
        created_by: context.userId,
      } as any).select().single();
    if (cErr) throw new Error(cErr.message);

    // Create or reuse auth user for the admin
    const tempPassword = generateTempPassword();
    let adminUserId: string | null = null;

    const { data: created, error: uErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.admin.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: data.admin.full_name,
        phone: data.admin.phone,
        must_reset_password: true,
      },
    });
    let reusedExistingUser = false;
    if (uErr) {
      // If already exists, look them up
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users.find((u) => u.email?.toLowerCase() === data.admin.email.toLowerCase());
      if (!found) throw new Error(uErr.message);
      adminUserId = found.id;
      reusedExistingUser = true;
    } else {
      adminUserId = created.user?.id ?? null;
    }
    if (!adminUserId) throw new Error("Failed to create admin user");

    await supabaseAdmin.from("company_members").insert({ company_id: company.id, user_id: adminUserId })
      .then(() => null, () => null);
    await supabaseAdmin.from("user_roles").insert({
      user_id: adminUserId, company_id: company.id, role: "company_admin",
    }).then(() => null, () => null);

    return {
      company,
      admin: { userId: adminUserId, email: data.admin.email },
      tempPassword: reusedExistingUser ? null : tempPassword,
      reusedExistingUser,
    };
  });

export const updateCompanyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; status: "active" | "suspended" }) =>
    z.object({ companyId: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("companies")
      .update({ status: data.status }).eq("id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCompanyById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("companies").delete().eq("id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- users (super admin OR company admin) ----------------

export const listCompanyUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertCompanyAdmin(context.supabase, context.userId, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: members } = await supabaseAdmin
      .from("company_members").select("user_id").eq("company_id", data.companyId);
    const ids = (members ?? []).map((m) => m.user_id);
    if (ids.length === 0) return [];
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email, phone, is_active, must_reset_password").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").eq("company_id", data.companyId).in("user_id", ids),
    ]);
    const byUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role);
      byUser.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    companyId: string;
    full_name: string; email: string; phone?: string;
    role: "manager" | "employee" | "company_admin";
  }) => z.object({
    companyId: z.string().uuid(),
    full_name: z.string().trim().min(1).max(120),
    email: z.string().email(),
    phone: z.string().max(40).optional(),
    role: z.enum(["manager", "employee", "company_admin"]),
  }).parse(data))
  .handler(async ({ data, context }) => {
    // Only super admin may create company_admin. Company admins can create manager/employee.
    const { supabase, userId } = context;
    const { data: sa } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
    if (data.role === "company_admin" && !sa) {
      throw new Error("Only Super Admin can create Company Admins");
    }
    if (!sa) await assertCompanyAdmin(supabase, userId, data.companyId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tempPassword = generateTempPassword();

    let newUserId: string | null = null;
    let reused = false;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: tempPassword, email_confirm: true,
      user_metadata: {
        full_name: data.full_name, phone: data.phone, must_reset_password: true,
      },
    });
    if (error) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
      if (!found) throw new Error(error.message);
      newUserId = found.id; reused = true;
    } else {
      newUserId = created.user?.id ?? null;
    }
    if (!newUserId) throw new Error("Failed to create user");

    await supabaseAdmin.from("company_members").insert({ company_id: data.companyId, user_id: newUserId })
      .then(() => null, () => null);
    await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId, company_id: data.companyId, role: data.role,
    }).then(() => null, () => null);

    return { userId: newUserId, email: data.email, tempPassword: reused ? null : tempPassword, reusedExistingUser: reused };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; companyId: string }) =>
    z.object({ userId: z.string().uuid(), companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertCompanyAdmin(context.supabase, context.userId, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tempPassword = generateTempPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: tempPassword,
      user_metadata: { must_reset_password: true },
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_reset_password: true }).eq("id", data.userId);
    return { tempPassword };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; companyId: string; isActive: boolean }) =>
    z.object({ userId: z.string().uuid(), companyId: z.string().uuid(), isActive: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertCompanyAdmin(context.supabase, context.userId, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ is_active: data.isActive }).eq("id", data.userId);
    // Ban/unban via auth admin
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.isActive ? "none" : "8760h",
    } as any);
    return { ok: true };
  });
