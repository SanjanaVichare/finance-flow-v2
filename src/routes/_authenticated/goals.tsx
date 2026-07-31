import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listGoals, upsertGoal, deleteGoal } from "@/lib/finance.functions";
import { useMyCompany } from "@/hooks/use-my-company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { Plus, Trash2, Target, Calendar, TrendingUp, PiggyBank, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Goals — LedgerFlow" }, { name: "robots", content: "noindex" }] }),
  component: GoalsPage,
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
  .goals-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .goals-scroll::-webkit-scrollbar-track {
    background: ${COLORS.cream};
    border-radius: 3px;
  }
  .goals-scroll::-webkit-scrollbar-thumb {
    background: ${COLORS.mutedGold};
    border-radius: 3px;
    transition: background 0.2s ease;
  }
  .goals-scroll::-webkit-scrollbar-thumb:hover {
    background: ${COLORS.deepBlue};
  }
  .goals-scroll {
    scrollbar-width: thin;
    scrollbar-color: ${COLORS.mutedGold} ${COLORS.cream};
  }
`;

const GOAL_ICONS = {
  saving: PiggyBank,
  revenue: TrendingUp,
  expense_reduction: Wallet,
};

const GOAL_LABELS = {
  saving: "Saving",
  revenue: "Revenue",
  expense_reduction: "Expense Reduction",
};

function GoalsPage() {
  const { data: my } = useMyCompany();
  const companyId = my?.company?.id;
  const currency = my?.company?.currency ?? "INR";

  const list = useServerFn(listGoals);
  const upsert = useServerFn(upsertGoal);
  const del = useServerFn(deleteGoal);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState("saving");
  const [target, setTarget] = useState<number | "">("");
  const [current, setCurrent] = useState<number | "">(0);
  const [deadline, setDeadline] = useState("");

  const q = useQuery({
    enabled: !!companyId, queryKey: ["goals", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
  });

  const save = useMutation({
    mutationFn: () => upsert({
      data: {
        companyId: companyId!, name, goalType,
        targetAmount: Number(target), currentAmount: Number(current || 0),
        deadline: deadline || null,
      }
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals", companyId] });
      toast.success("Saved"); setOpen(false); setName(""); setTarget(""); setCurrent(0); setDeadline("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals", companyId] }); toast.success("Deleted"); },
  });

  if (!companyId) return <div className="text-muted-foreground">Create a workspace first.</div>;

  return (
    <div className="space-y-6 goals-scroll" style={{ backgroundColor: COLORS.cream }}>
      <style>{scrollbarStyles}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)", color: COLORS.deepBlue }}>
            Goals
          </h1>
          <p className="text-sm" style={{ color: COLORS.mutedGold }}>
            Track savings, revenue, or reduction targets.
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
              <Plus className="h-4 w-4" /> New goal
            </Button>
          </DialogTrigger>
          <DialogContent style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
            <DialogHeader>
              <DialogTitle style={{ color: COLORS.deepBlue }}>New goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label style={{ color: COLORS.deepBlue }}>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Emergency fund"
                  className="focus:border-mutedGold focus:ring-mutedGold"
                  style={{ borderColor: COLORS.mutedGold }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label style={{ color: COLORS.deepBlue }}>Type</Label>
                  <Select value={goalType} onValueChange={setGoalType}>
                    <SelectTrigger className="focus:border-mutedGold focus:ring-mutedGold" style={{ borderColor: COLORS.mutedGold }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="saving">Saving</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense_reduction">Expense reduction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label style={{ color: COLORS.deepBlue }}>Deadline</Label>
                  <Input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="focus:border-mutedGold focus:ring-mutedGold"
                    style={{ borderColor: COLORS.mutedGold }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label style={{ color: COLORS.deepBlue }}>Target ({currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={target}
                    onChange={(e) => setTarget(e.target.value === "" ? "" : Number(e.target.value))}
                    className="focus:border-mutedGold focus:ring-mutedGold"
                    style={{ borderColor: COLORS.mutedGold }}
                  />
                </div>
                <div className="space-y-2">
                  <Label style={{ color: COLORS.deepBlue }}>Current ({currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value === "" ? 0 : Number(e.target.value))}
                    className="focus:border-mutedGold focus:ring-mutedGold"
                    style={{ borderColor: COLORS.mutedGold }}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => save.mutate()}
                disabled={!name || !target || save.isPending}
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
        {(q.data ?? []).map((g) => {
          const pct = Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100));
          const Icon = GOAL_ICONS[g.goal_type as keyof typeof GOAL_ICONS] || Target;

          // Determine progress color
          const getProgressColor = () => {
            if (pct >= 100) return COLORS.deepBlue;
            if (pct >= 75) return COLORS.warmGold;
            return COLORS.mutedGold;
          };

          return (
            <Card key={g.id} style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
              <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="grid h-8 w-8 place-items-center rounded-md flex-shrink-0"
                      style={{
                        backgroundColor: COLORS.warmGold,
                        color: COLORS.deepBlue,
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base" style={{ color: COLORS.deepBlue }}>{g.name}</CardTitle>
                      <div className="text-xs" style={{ color: COLORS.mutedGold }}>
                        {GOAL_LABELS[g.goal_type as keyof typeof GOAL_LABELS] || g.goal_type}
                        {g.deadline && (
                          <span className="flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3" />
                            due {g.deadline}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove.mutate(g.id)}
                  style={{ color: COLORS.softPink }}
                  className="hover:bg-pink-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
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
                    className="absolute top-0 left-0 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: getProgressColor(),
                      borderRadius: '4px',
                    }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="tabular" style={{ color: COLORS.deepBlue }}>
                    {formatMoney(g.current_amount, currency)}
                  </span>
                  <span className="tabular" style={{ color: COLORS.mutedGold }}>
                    of {formatMoney(g.target_amount, currency)} · <span style={{ color: pct >= 100 ? COLORS.deepBlue : COLORS.mutedGold }}>{pct}%</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {q.data?.length === 0 && (
          <Card className="col-span-full" style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
            <CardContent className="p-8 text-center text-sm" style={{ color: COLORS.mutedGold }}>
              No goals yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}