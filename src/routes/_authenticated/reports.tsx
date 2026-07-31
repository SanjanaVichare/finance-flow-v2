import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTransactions } from "@/lib/finance.functions";
import { useMyCompany } from "@/hooks/use-my-company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — LedgerFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

// ─── Page ──────────────────────────────────────────────

function ReportsPage() {
  const { data: my } = useMyCompany();
  const companyId = my?.company?.id;
  const currency = my?.company?.currency ?? "INR";

  const { from, to, handleFromChange, handleToChange } = useDateRange();
  const { data, isLoading } = useTransactions(companyId, from, to);
  const totals = useTotals(data);

  if (!companyId) {
    return <NoCompanyMessage />;
  }

  return (
    <div className="space-y-6">
      <PageHeader />
      <FilterBar from={from} to={to} onFromChange={handleFromChange} onToChange={handleToChange} onExport={() => exportCSV(data, from, to)} />
      <TotalsGrid totals={totals} currency={currency} />
      <TransactionsTable data={data} currency={currency} isLoading={isLoading} />
    </div>
  );
}

// ─── Hooks ─────────────────────────────────────────────

function useDateRange() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayStr);

  return {
    from,
    to,
    handleFromChange: (e: React.ChangeEvent<HTMLInputElement>) => setFrom(e.target.value),
    handleToChange: (e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value),
  };
}

function useTransactions(companyId: string | undefined, from: string, to: string) {
  const listFn = useServerFn(listTransactions);
  const { data, isLoading } = useQuery({
    enabled: !!companyId,
    queryKey: ["report", companyId, from, to],
    queryFn: () => listFn({ data: { companyId: companyId!, from, to, limit: 1000 } }),
  });

  return { data: data ?? [], isLoading };
}

function useTotals(data: any[]) {
  return useMemo(() => {
    let income = 0;
    let expense = 0;

    data.forEach((t) => {
      const amount = Number(t.amount);
      if (t.type === "income") income += amount;
      if (t.type === "expense") expense += amount;
    });

    return {
      income,
      expense,
      profit: income - expense,
      count: data.length,
    };
  }, [data]);
}

// ─── Components ────────────────────────────────────────

function NoCompanyMessage() {
  return <div className="text-muted-foreground">Create a workspace first.</div>;
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
        Reports
      </h1>
      <p className="text-sm text-muted-foreground">Filter by date range and export.</p>
    </div>
  );
}

function FilterBar({
  from,
  to,
  onFromChange,
  onToChange,
  onExport,
}: {
  from: string;
  to: string;
  onFromChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-wrap items-end gap-3">
        <DateInput id="from" label="From" value={from} onChange={onFromChange} />
        <DateInput id="to" label="To" value={to} onChange={onToChange} />
        <ExportButton onClick={onExport} />
      </CardContent>
    </Card>
  );
}

function DateInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" value={value} onChange={onChange} />
    </div>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" className="gap-2" onClick={onClick}>
      <Download className="h-4 w-4" /> Export CSV
    </Button>
  );
}

function TotalsGrid({
  totals,
  currency,
}: {
  totals: { count: number; income: number; expense: number; profit: number };
  currency: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <TotalCard label="Transactions" value={totals.count.toString()} />
      <TotalCard
        label="Income"
        value={formatMoney(totals.income, currency)}
        tone="success"
      />
      <TotalCard
        label="Expense"
        value={formatMoney(totals.expense, currency)}
        tone="destructive"
      />
      <TotalCard
        label="Net"
        value={formatMoney(totals.profit, currency)}
        tone={totals.profit >= 0 ? "success" : "destructive"}
      />
    </div>
  );
}

function TotalCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "destructive";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : "";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-semibold tabular ${toneClass}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionsTable({
  data,
  currency,
  isLoading,
}: {
  data: any[];
  currency: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Transactions</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <EmptyState colSpan={5} />
            ) : (
              data.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  currency={currency}
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <Card>
      <CardContent className="p-8 text-center text-muted-foreground">
        Loading transactions...
      </CardContent>
    </Card>
  );
}

function EmptyState({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center py-10 text-sm text-muted-foreground">
        No transactions in range.
      </TableCell>
    </TableRow>
  );
}

function TransactionRow({ transaction, currency }: { transaction: any; currency: string }) {
  const categoryName = (transaction.category as unknown as { name?: string })?.name ?? "—";
  const accountName = (transaction.account as unknown as { name?: string })?.name;

  const amountClass =
    transaction.type === "income"
      ? "text-success"
      : transaction.type === "expense"
        ? "text-destructive"
        : "";

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{transaction.occurred_on}</TableCell>
      <TableCell className="capitalize">{transaction.type}</TableCell>
      <TableCell>{categoryName}</TableCell>
      <TableCell>{accountName}</TableCell>
      <TableCell className={`text-right tabular ${amountClass}`}>
        {formatMoney(transaction.amount, currency)}
      </TableCell>
    </TableRow>
  );
}

// ─── Utils ─────────────────────────────────────────────

function exportCSV(data: any[], from: string, to: string) {
  if (data.length === 0) return;

  const header = ["Date", "Type", "Amount", "Category", "Account", "Vendor", "Description"];

  const rows = data.map((t) => [
    t.occurred_on,
    t.type,
    t.amount,
    (t.category as unknown as { name?: string })?.name ?? "",
    (t.account as unknown as { name?: string })?.name ?? "",
    (t.vendor ?? "").replace(/,/g, " "),
    (t.description ?? "").replace(/,/g, " "),
  ]);

  const csv = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ledgerflow-${from}_to_${to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}