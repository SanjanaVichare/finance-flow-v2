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
  head: () => ({ meta: [{ title: "Reports — LedgerFlow" }, { name: "robots", content: "noindex" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: my } = useMyCompany();
  const companyId = my?.company?.id;
  const currency = my?.company?.currency ?? "INR";

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const listFn = useServerFn(listTransactions);
  const q = useQuery({
    enabled: !!companyId,
    queryKey: ["report", companyId, from, to],
    queryFn: () => listFn({ data: { companyId: companyId!, from, to, limit: 1000 } }),
  });

  const totals = useMemo(() => {
    const data = q.data ?? [];
    let income = 0, expense = 0;
    data.forEach((t) => {
      const a = Number(t.amount);
      if (t.type === "income") income += a;
      if (t.type === "expense") expense += a;
    });
    return { income, expense, profit: income - expense, count: data.length };
  }, [q.data]);

  function exportCSV() {
    const rows = q.data ?? [];
    const header = ["Date","Type","Amount","Category","Account","Vendor","Description"];
    const csv = [header.join(",")]
      .concat(rows.map((t) => [
        t.occurred_on, t.type, t.amount,
        (t.category as unknown as { name?: string } | null)?.name ?? "",
        (t.account as unknown as { name?: string } | null)?.name ?? "",
        (t.vendor ?? "").replace(/,/g, " "),
        (t.description ?? "").replace(/,/g, " "),
      ].join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ledgerflow-${from}_to_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!companyId) return <div className="text-muted-foreground">Create a workspace first.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Reports</h1>
        <p className="text-sm text-muted-foreground">Filter by date range and export.</p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-2"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-2"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <Button variant="outline" className="gap-2" onClick={exportCSV}><Download className="h-4 w-4" /> Export CSV</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Transactions</div><div className="mt-1 text-2xl font-semibold tabular">{totals.count}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Income</div><div className="mt-1 text-2xl font-semibold tabular text-success">{formatMoney(totals.income, currency)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Expense</div><div className="mt-1 text-2xl font-semibold tabular text-destructive">{formatMoney(totals.expense, currency)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Net</div><div className={`mt-1 text-2xl font-semibold tabular ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}>{formatMoney(totals.profit, currency)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Transactions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Category</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(q.data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground">{t.occurred_on}</TableCell>
                  <TableCell className="capitalize">{t.type}</TableCell>
                  <TableCell>{(t.category as unknown as { name?: string } | null)?.name ?? "—"}</TableCell>
                  <TableCell>{(t.account as unknown as { name?: string } | null)?.name}</TableCell>
                  <TableCell className={`text-right tabular ${t.type === "income" ? "text-success" : t.type === "expense" ? "text-destructive" : ""}`}>{formatMoney(t.amount, currency)}</TableCell>
                </TableRow>
              ))}
              {(!q.data || q.data.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-sm text-muted-foreground">No transactions in range.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
