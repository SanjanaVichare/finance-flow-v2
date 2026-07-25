import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBudgets, upsertBudget, listCategories } from "@/lib/finance.functions";
import { useMyCompany } from "@/hooks/use-my-company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { formatMoney, firstOfMonthISO } from "@/lib/format";
import { Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/budgets")({
  head: () => ({ meta: [{ title: "Budgets — LedgerFlow" }, { name: "robots", content: "noindex" }] }),
  component: BudgetsPage,
});

function BudgetsPage() {
  const { data: my } = useMyCompany();
  const companyId = my?.company?.id;
  const currency = my?.company?.currency ?? "INR";
  const [month] = useState(firstOfMonthISO());

  const list = useServerFn(listBudgets);
  const listCat = useServerFn(listCategories);
  const upsert = useServerFn(upsertBudget);
  const qc = useQueryClient();

  const q = useQuery({
    enabled: !!companyId, queryKey: ["budgets", companyId, month],
    queryFn: () => list({ data: { companyId: companyId!, month } }),
  });
  const cats = useQuery({
    enabled: !!companyId, queryKey: ["categories", companyId],
    queryFn: () => listCat({ data: { companyId: companyId! } }),
  });

  const expenseCats = useMemo(() => (cats.data ?? []).filter((c) => c.group === "expense"), [cats.data]);

  const [open, setOpen] = useState(false);
  const [catId, setCatId] = useState("");
  const [limit, setLimit] = useState<number | "">("");

  const save = useMutation({
    mutationFn: () => upsert({ data: { companyId: companyId!, categoryId: catId, month, monthlyLimit: Number(limit) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets", companyId, month] });
      toast.success("Saved"); setOpen(false); setCatId(""); setLimit("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!companyId) return <div className="text-muted-foreground">Create a workspace first.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Budgets</h1>
          <p className="text-sm text-muted-foreground">Monthly limits per expense category · {month.slice(0,7)}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Set budget</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Set monthly budget</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={catId} onValueChange={setCatId}>
                  <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>
                    {expenseCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monthly limit ({currency})</Label>
                <Input type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={!catId || !limit || save.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(q.data ?? []).map((b) => {
          const spent = Number(b.spent);
          const limitN = Number(b.monthly_limit);
          const pct = limitN > 0 ? Math.min(100, (spent / limitN) * 100) : 0;
          const warn = pct >= 90;
          return (
            <Card key={b.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{(b.category as unknown as { name?: string } | null)?.name ?? "—"}</CardTitle>
                  {warn && <span className="inline-flex items-center gap-1 text-xs text-warning-foreground bg-warning/20 px-2 py-1 rounded-full"><AlertTriangle className="h-3 w-3" />{pct >= 100 ? "Over budget" : "Nearing limit"}</span>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress value={pct} className={warn ? "[&>*]:bg-destructive" : ""} />
                <div className="flex justify-between text-sm">
                  <span className="tabular">{formatMoney(spent, currency)} spent</span>
                  <span className="tabular text-muted-foreground">of {formatMoney(limitN, currency)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {q.data?.length === 0 && (
          <Card className="col-span-full"><CardContent className="p-8 text-center text-sm text-muted-foreground">No budgets set for this month.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
