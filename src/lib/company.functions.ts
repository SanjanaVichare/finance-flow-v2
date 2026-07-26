import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertCompanyAdmin(
    supabase: any,
    userId: string,
    companyId: string
) {
    const { data: sa } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "super_admin")
        .maybeSingle();

    if (sa) return;

    const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .eq("role", "company_admin")
        .maybeSingle();

    if (!data) throw new Error("Forbidden");
}

export const bulkCreateEmployees = createServerFn({
    method: "POST",
})
    .middleware([requireSupabaseAuth])
    .validator((data: {
        companyId: string;
        rows: any[];
    }) =>
        z.object({
            companyId: z.string().uuid(),
            rows: z.array(z.any()),
        }).parse(data)
    )
    .handler(async ({ data, context }) => {
        await assertCompanyAdmin(
            context.supabase,
            context.userId,
            data.companyId
        );

        const entities = data.rows.map((row: Record<string, any>) => ({
            company_id: data.companyId,

            type: "employee" as const,

            name: row["Name"],

            email: row["Email"] ?? null,

            phone: row["Phone"] ?? null,

            department: row["Department"] ?? null,

            code: row["Employee ID"] ?? null,

            created_by: context.userId,
        }));

        const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
        );

        const { error } = await supabaseAdmin
            .from("entities")
            .insert(entities);

        if (error) throw new Error(error.message);

        return {
            inserted: entities.length,
        };
    });

export const bulkCreateProducts = createServerFn({
    method: "POST",
})
    .middleware([requireSupabaseAuth])
    .validator((data: {
        companyId: string;
        rows: any[];
    }) =>
        z.object({
            companyId: z.string().uuid(),
            rows: z.array(z.any()),
        }).parse(data)
    )
    .handler(async ({ data, context }) => {
        await assertCompanyAdmin(
            context.supabase,
            context.userId,
            data.companyId
        );

        const products = data.rows.map((row: Record<string, any>) => ({
            company_id: data.companyId,

            sku: row["SKU"] ?? null,

            name: row["Name"],

            category: row["Category"] ?? null,

            purchase_price: Number(row["Purchase Price"] ?? 0),

            selling_price: Number(row["Selling Price"] ?? 0),

            stock: Number(row["Stock"] ?? 0),

            created_by: context.userId,
        }));

        const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
        );

        const { error } = await (supabaseAdmin as any)
            .from("products")
            .insert(products);

        if (error) throw new Error(error.message);

        return {
            inserted: products.length,
        };
    });

export const bulkCreateStudents = createServerFn({
    method: "POST",
})
    .middleware([requireSupabaseAuth])
    .validator((data: {
        companyId: string;
        rows: any[];
    }) =>
        z.object({
            companyId: z.string().uuid(),
            rows: z.array(z.any()),
        }).parse(data)
    )
    .handler(async ({ data, context }) => {

        await assertCompanyAdmin(
            context.supabase,
            context.userId,
            data.companyId
        );

        const entities = data.rows.map((row: Record<string, any>) => ({
            company_id: data.companyId,

            type: "student" as const,

            name: row["Name"],

            email: row["Email"] ?? null,

            phone: row["Phone"] ?? null,

            class_name: row["Class"] ?? null,

            code: row["Roll No"] ?? null,

            created_by: context.userId,
        }));

        const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
        );

        const { error } = await supabaseAdmin
            .from("entities")
            .insert(entities);

        if (error) throw new Error(error.message);

        return {
            inserted: entities.length,
        };
    });