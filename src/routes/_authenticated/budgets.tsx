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
import { Plus, AlertTriangle, Target } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/budgets")({
  head: () => ({ meta: [{ title: "Budgets — LedgerFlow" }, { name: "robots", content: "noindex" }] }),
  component: BudgetsPage,
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

// ─── Scrollbar Styles ─────────────────────────────────
const scrollbarStyles = `
  .budgets-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .budgets-scroll::-webkit-scrollbar-track {
    background: ${COLORS.cream};
    border-radius: 3px;
  }
  .budgets-scroll::-webkit-scrollbar-thumb {
    background: ${COLORS.mutedGold};
    border-radius: 3px;
    transition: background 0.2s ease;
  }
  .budgets-scroll::-webkit-scrollbar-thumb:hover {
    background: ${COLORS.deepBlue};
  }
  .budgets-scroll {
    scrollbar-width: thin;
    scrollbar-color: ${COLORS.mutedGold} ${COLORS.cream};
  }
`;

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
    <div className="space-y-6 budgets-scroll" style={{ backgroundColor: COLORS.cream }}>
      <style>{scrollbarStyles}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)", color: COLORS.deepBlue }}>
            Budgets
          </h1>
          <p className="text-sm" style={{ color: COLORS.mutedGold }}>
            Monthly limits per expense category · {month.slice(0, 7)}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              className="gap-2"
              style={{
                backgroundColor: COLORS.deepBlue,
                color: COLORS.white,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.mutedGold;
                e.currentTarget.style.color = COLORS.deepBlue;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.deepBlue;
                e.currentTarget.style.color = COLORS.white;
              }}
            >
              <Plus className="h-4 w-4" /> Set budget
            </Button>
          </DialogTrigger>
          <DialogContent style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
            <DialogHeader>
              <DialogTitle style={{ color: COLORS.deepBlue }}>Set monthly budget</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label style={{ color: COLORS.deepBlue }}>Category</Label>
                <Select value={catId} onValueChange={setCatId}>
                  <SelectTrigger className="focus:border-mutedGold focus:ring-mutedGold" style={{ borderColor: COLORS.mutedGold }}>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label style={{ color: COLORS.deepBlue }}>Monthly limit ({currency})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value === "" ? "" : Number(e.target.value))}
                  className="focus:border-mutedGold focus:ring-mutedGold"
                  style={{ borderColor: COLORS.mutedGold }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => save.mutate()}
                disabled={!catId || !limit || save.isPending}
                style={{
                  backgroundColor: COLORS.deepBlue,
                  color: COLORS.white,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = COLORS.mutedGold;
                  e.currentTarget.style.color = COLORS.deepBlue;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = COLORS.deepBlue;
                  e.currentTarget.style.color = COLORS.white;
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(q.data ?? []).map((b) => {
          const spent = Number(b.spent);
          const limitN = Number(b.monthly_limit);
          const pct = limitN > 0 ? Math.min(100, (spent / limitN) * 100) : 0;
          const warn = pct >= 90;

          // Determine progress bar color
          const getProgressColor = () => {
            if (pct >= 100) return COLORS.softPink;
            if (pct >= 90) return COLORS.warmGold;
            return COLORS.deepBlue;
          };

          return (
            <Card key={b.id} style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base" style={{ color: COLORS.deepBlue }}>
                    <Target className="h-4 w-4" style={{ color: COLORS.mutedGold }} />
                    {(b.category as unknown as { name?: string } | null)?.name ?? "—"}
                  </CardTitle>
                  {warn && (
                    <span
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: pct >= 100 ? COLORS.softPink : COLORS.warmGold,
                        color: pct >= 100 ? COLORS.white : COLORS.deepBlue,
                      }}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {pct >= 100 ? "Over budget" : "Nearing limit"}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="relative">
                  <Progress
                    value={pct}
                    className="h-2"
                    style={{
                      backgroundColor: COLORS.cream,
                    }}
                  />
                  <div
                    className="absolute top-0 left-0 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: getProgressColor(),
                      borderRadius: '4px',
                    }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="tabular" style={{ color: COLORS.deepBlue }}>
                    {formatMoney(spent, currency)} spent
                  </span>
                  <span className="tabular" style={{ color: COLORS.mutedGold }}>
                    of {formatMoney(limitN, currency)}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {q.data?.length === 0 && (
          <Card className="col-span-full" style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
            <CardContent className="p-8 text-center text-sm" style={{ color: COLORS.mutedGold }}>
              No budgets set for this month.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}