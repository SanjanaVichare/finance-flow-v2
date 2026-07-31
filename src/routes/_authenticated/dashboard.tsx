import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardSummary } from "@/lib/finance.functions";
import { useMyCompany } from "@/hooks/use-my-company";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import {
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
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

// ─── Color Palette ─────────────────────────────────────
const COLORS = {
  warmGold: "#FFD691",
  deepBlue: "#233A66",
  mutedGold: "#D7A859",
  softPink: "#FF6E80",
  white: "#FFFFFF",
  cream: "#F8F6F0",
  darkNavy: "#1A2A4A",
};

const CHART_COLORS = [
  COLORS.deepBlue,
  COLORS.warmGold,
  COLORS.mutedGold,
  COLORS.softPink,
  COLORS.cream,
];

// ─── Scrollbar Styles ─────────────────────────────────
const scrollbarStyles = `
  .dashboard-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .dashboard-scroll::-webkit-scrollbar-track {
    background: ${COLORS.cream};
    border-radius: 3px;
  }
  .dashboard-scroll::-webkit-scrollbar-thumb {
    background: ${COLORS.mutedGold};
    border-radius: 3px;
    transition: background 0.2s ease;
  }
  .dashboard-scroll::-webkit-scrollbar-thumb:hover {
    background: ${COLORS.deepBlue};
  }
  .dashboard-scroll {
    scrollbar-width: thin;
    scrollbar-color: ${COLORS.mutedGold} ${COLORS.cream};
  }
`;

// ─── Page ──────────────────────────────────────────────

function DashboardPage() {
  const { data, isLoading } = useMyCompany();

  if (isLoading) return <LoadingState />;
  if (!data?.company) return <NoCompanyState />;

  return <Dashboard companyId={data.company.id} currency={data.company.currency} />;
}

// ─── States ────────────────────────────────────────────

function LoadingState() {
  return <div className="text-muted-foreground">Loading…</div>;
}

function NoCompanyState() {
  return (
    <div className="mx-auto max-w-lg">
      <Card style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
        <CardHeader>
          <CardTitle style={{ fontFamily: "var(--font-display)", color: COLORS.deepBlue }}>
            No workspace assigned
          </CardTitle>
          <CardDescription style={{ color: COLORS.darkNavy }}>
            Your account isn't linked to a company yet. Please contact your Super Admin or Company Admin
            to be added to a workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

// ─── Components ────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone?: "default" | "success" | "destructive";
}) {
  const getColor = () => {
    if (tone === "success") return COLORS.deepBlue;
    if (tone === "destructive") return COLORS.softPink;
    return COLORS.deepBlue;
  };

  return (
    <Card style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm" style={{ color: COLORS.mutedGold }}>{label}</div>
          <Icon className="h-4 w-4" style={{ color: COLORS.mutedGold }} />
        </div>
        <div
          className="mt-2 text-2xl font-semibold tabular"
          style={{ fontFamily: "var(--font-display)", color: getColor() }}
        >
          {value}
        </div>
        {sub && <div className="mt-1 text-xs" style={{ color: COLORS.mutedGold }}>{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ─── Dashboard ─────────────────────────────────────────

function Dashboard({ companyId, currency }: { companyId: string; currency: string }) {
  const fn = useServerFn(getDashboardSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", companyId],
    queryFn: () => fn({ data: { companyId } }),
  });

  if (isLoading || !data) return <LoadingState />;

  return (
    <div className="space-y-6 dashboard-scroll" style={{ backgroundColor: COLORS.cream }}>
      <style>{scrollbarStyles}</style>

      <Header />

      <KpiGrid data={data} currency={currency} />

      <ChartSection data={data} currency={currency} />

      <RecentTransactions data={data} currency={currency} />
    </div>
  );
}

// ─── Dashboard Subcomponents ──────────────────────────

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)", color: COLORS.deepBlue }}>
        Dashboard
      </h1>
      <p className="text-sm" style={{ color: COLORS.mutedGold }}>Live financial overview.</p>
    </div>
  );
}

function KpiGrid({ data, currency }: { data: any; currency: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Net balance" value={formatMoney(data.netBalance, currency)} icon={Wallet} />
      <KpiCard
        label="This month · Income"
        value={formatMoney(data.monthIncome, currency)}
        icon={ArrowUpRight}
        tone="success"
      />
      <KpiCard
        label="This month · Expense"
        value={formatMoney(data.monthExpense, currency)}
        icon={ArrowDownRight}
        tone="destructive"
      />
      <KpiCard
        label="Profit"
        value={formatMoney(data.profit, currency)}
        icon={TrendingUp}
        tone={data.profit >= 0 ? "success" : "destructive"}
      />
    </div>
  );
}

function ChartSection({
  data,
  currency,
}: {
  data: any;
  currency: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <MonthlyBarChart data={data.monthlyTrend} currency={currency} />
      <CategoryPieChart data={data.categoryBreakdown} currency={currency} />
    </div>
  );
}

function MonthlyBarChart({
  data,
  currency,
}: {
  data: any[];
  currency: string;
}) {
  return (
    <Card className="lg:col-span-2" style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
      <CardHeader>
        <CardTitle className="text-base" style={{ color: COLORS.deepBlue }}>
          Income vs Expense (monthly)
        </CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.cream} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              stroke={COLORS.mutedGold}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke={COLORS.mutedGold}
            />
            <ReTooltip
              formatter={(v: number) => formatMoney(v, currency)}
              contentStyle={{
                background: COLORS.white,
                border: `1px solid ${COLORS.mutedGold}`,
                borderRadius: 8,
                color: COLORS.deepBlue,
              }}
            />
            <Legend
              wrapperStyle={{ color: COLORS.deepBlue }}
            />
            <Bar
              dataKey="income"
              fill={COLORS.deepBlue}
              radius={[6, 6, 0, 0]}
            />
            <Bar
              dataKey="expense"
              fill={COLORS.softPink}
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function CategoryPieChart({
  data,
  currency,
}: {
  data: any[];
  currency: string;
}) {
  return (
    <Card style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
      <CardHeader>
        <CardTitle className="text-base" style={{ color: COLORS.deepBlue }}>
          Top expense categories
        </CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? (
          <div className="grid h-full place-items-center text-sm" style={{ color: COLORS.mutedGold }}>
            No expense data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                innerRadius={45}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={true}
              >
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <ReTooltip
                formatter={(v: number) => formatMoney(v, currency)}
                contentStyle={{
                  background: COLORS.white,
                  border: `1px solid ${COLORS.mutedGold}`,
                  borderRadius: 8,
                  color: COLORS.deepBlue,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function RecentTransactions({ data, currency }: { data: any; currency: string }) {
  return (
    <Card style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
      <CardHeader>
        <CardTitle className="text-base" style={{ color: COLORS.deepBlue }}>
          Recent transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.recent.length === 0 ? (
          <div className="text-sm" style={{ color: COLORS.mutedGold }}>No transactions yet.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: COLORS.cream }}>
            {data.recent.map((t: any) => (
              <TransactionItem key={t.id} transaction={t} currency={currency} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TransactionItem({ transaction, currency }: { transaction: any; currency: string }) {
  const description =
    transaction.description ||
    transaction.vendor ||
    (transaction.category as unknown as { name?: string })?.name ||
    "Transaction";

  const accountName = (transaction.account as unknown as { name?: string })?.name;

  const amountSign = transaction.type === "expense" ? "-" : transaction.type === "income" ? "+" : "";

  // Determine color based on transaction type
  const getColor = () => {
    if (transaction.type === "income") return COLORS.deepBlue;
    if (transaction.type === "expense") return COLORS.softPink;
    return COLORS.mutedGold;
  };

  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-sm font-medium" style={{ color: COLORS.deepBlue }}>
          {description}
        </div>
        <div className="text-xs" style={{ color: COLORS.mutedGold }}>
          {transaction.occurred_on} · {accountName}
        </div>
      </div>
      <div
        className="tabular text-sm font-semibold"
        style={{ color: getColor() }}
      >
        {amountSign}
        {formatMoney(transaction.amount, currency)}
      </div>
    </div>
  );
}