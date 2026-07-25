import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardSummary } from "@/lib/finance.functions";
import { useMyCompany } from "@/hooks/use-my-company";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import {
  ArrowDownRight, ArrowUpRight, TrendingUp, Wallet,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — LedgerFlow" },
      { name: "description", content: "Live overview of your company's finances." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useMyCompany();
  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!data?.company) return <NoCompany />;
  return <Dashboard companyId={data.company.id} currency={data.company.currency} />;
}

function NoCompany() {
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle style={{ fontFamily: "var(--font-display)" }}>No workspace assigned</CardTitle>
          <CardDescription>
            Your account isn't linked to a company yet. Please contact your Super Admin or Company Admin
            to be added to a workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}


function Kpi({ label, value, sub, icon: Icon, tone = "default" }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  tone?: "default" | "success" | "destructive";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{label}</div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className={`mt-2 text-2xl font-semibold tabular ${toneClass}`} style={{ fontFamily: "var(--font-display)" }}>
          {value}
        </div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Dashboard({ companyId, currency }: { companyId: string; currency: string }) {
  const fn = useServerFn(getDashboardSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", companyId],
    queryFn: () => fn({ data: { companyId } }),
  });

  

  const pieColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
  const chartColors = useMemo(() => ["var(--chart-1)","var(--chart-2)","var(--chart-3)","var(--chart-4)","var(--chart-5)"], []);

  if (isLoading || !data) return <div className="text-muted-foreground">Loading dashboard…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">Live financial overview.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Net balance" value={formatMoney(data.netBalance, currency)} icon={Wallet} />
        <Kpi label="This month · Income" value={formatMoney(data.monthIncome, currency)} icon={ArrowUpRight} tone="success" />
        <Kpi label="This month · Expense" value={formatMoney(data.monthExpense, currency)} icon={ArrowDownRight} tone="destructive" />
        <Kpi label="Profit" value={formatMoney(data.profit, currency)} icon={TrendingUp} tone={data.profit >= 0 ? "success" : "destructive"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Income vs Expense (monthly)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <ReTooltip formatter={(v: number) => formatMoney(v, currency)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="income" fill={chartColors[1]} radius={[6,6,0,0]} />
                <Bar dataKey="expense" fill={chartColors[3]} radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top expense categories</CardTitle></CardHeader>
          <CardContent className="h-72">
            {data.categoryBreakdown.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">No expense data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.categoryBreakdown} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45}>
                    {data.categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                  <ReTooltip formatter={(v: number) => formatMoney(v, currency)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Monthly trend</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <ReTooltip formatter={(v: number) => formatMoney(v, currency)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="income" stroke={chartColors[1]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expense" stroke={chartColors[3]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent transactions</CardTitle></CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <div className="text-sm text-muted-foreground">No transactions yet.</div>
          ) : (
            <div className="divide-y">
              {data.recent.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium">
                      {t.description || t.vendor || (t.category as unknown as { name?: string } | null)?.name || "Transaction"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.occurred_on} · {(t.account as unknown as { name?: string } | null)?.name}
                    </div>
                  </div>
                  <div className={`tabular text-sm font-semibold ${t.type === "income" ? "text-success" : t.type === "expense" ? "text-destructive" : "text-foreground"}`}>
                    {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}
                    {formatMoney(t.amount, currency)}
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
