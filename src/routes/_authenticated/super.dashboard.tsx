import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformStats, listRecentActivity } from "@/lib/super.functions";
import { getMyProfile } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, TrendingUp, TrendingDown, Wallet, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/super/dashboard")({
  head: () => ({ meta: [{ title: "Super Admin — Overview" }, { name: "robots", content: "noindex" }] }),
  component: SuperDashboard,
});

function SuperDashboard() {
  const profileFn = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn(), staleTime: 60_000 });

  const statsFn = useServerFn(getPlatformStats);
  const { data: stats } = useQuery({
    queryKey: ["platform-stats"], queryFn: () => statsFn(),
    enabled: Boolean(profile?.isSuperAdmin),
  });
  const activityFn = useServerFn(listRecentActivity);
  const { data: activity } = useQuery({
    queryKey: ["recent-activity"], queryFn: () => activityFn(),
    enabled: Boolean(profile?.isSuperAdmin),
  });

  if (profile && !profile.isSuperAdmin) {
    return <div className="text-sm text-muted-foreground">Super Admin access required.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Platform Overview
          </h1>
          <p className="text-sm text-muted-foreground">Cross-company stats across the entire platform.</p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/admin/companies">Manage companies <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Companies" value={String(stats?.totalCompanies ?? "—")} sub={`${stats?.activeCompanies ?? 0} active`} icon={Building2} />
        <Kpi label="Active users" value={String(stats?.activeUsers ?? "—")} icon={Users} />
        <Kpi label="Total income" value={fmt(stats?.totalIncome)} icon={TrendingUp} tone="success" />
        <Kpi label="Total expense" value={fmt(stats?.totalExpense)} icon={TrendingDown} tone="destructive" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Net profit" value={fmt(stats?.netProfit)} icon={Wallet} tone={(stats?.netProfit ?? 0) >= 0 ? "success" : "destructive"} />
        <Kpi label="Transactions" value={String(stats?.totalTransactions ?? "—")} icon={Wallet} />
        <Kpi label="Personal" value={String(stats?.personalCompanies ?? "—")} icon={Building2} />
        <Kpi label="Commercial" value={String(stats?.commercialCompanies ?? "—")} icon={Building2} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription>Latest audit events across the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {(activity ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">No activity yet.</div>
          ) : (
            <div className="divide-y">
              {(activity ?? []).slice(0, 15).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{a.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.table_name ?? "—"} · {a.record_id?.slice(0, 8) ?? "—"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function fmt(n: number | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function Kpi({ label, value, sub, icon: Icon, tone = "default" }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  tone?: "default" | "success" | "destructive";
}) {
  const toneClass = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{label}</div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`} style={{ fontFamily: "var(--font-display)" }}>
          {value}
        </div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
