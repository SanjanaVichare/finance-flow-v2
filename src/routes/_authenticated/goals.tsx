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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Goals — LedgerFlow" }, { name: "robots", content: "noindex" }] }),
  component: GoalsPage,
});

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
    mutationFn: () => upsert({ data: {
      companyId: companyId!, name, goalType,
      targetAmount: Number(target), currentAmount: Number(current || 0),
      deadline: deadline || null,
    } }),
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Goals</h1>
          <p className="text-sm text-muted-foreground">Track savings, revenue, or reduction targets.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New goal</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New goal</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Emergency fund" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={goalType} onValueChange={setGoalType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="saving">Saving</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense_reduction">Expense reduction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Deadline</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Target ({currency})</Label><Input type="number" step="0.01" value={target} onChange={(e) => setTarget(e.target.value === "" ? "" : Number(e.target.value))} /></div>
                <div className="space-y-2"><Label>Current ({currency})</Label><Input type="number" step="0.01" value={current} onChange={(e) => setCurrent(e.target.value === "" ? 0 : Number(e.target.value))} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={!name || !target || save.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(q.data ?? []).map((g) => {
          const pct = Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100));
          return (
            <Card key={g.id}>
              <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{g.name}</CardTitle>
                  <div className="text-xs text-muted-foreground capitalize">{g.goal_type.replace("_", " ")}{g.deadline ? ` · due ${g.deadline}` : ""}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(g.id)}><Trash2 className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress value={pct} />
                <div className="flex justify-between text-sm">
                  <span className="tabular">{formatMoney(g.current_amount, currency)}</span>
                  <span className="tabular text-muted-foreground">of {formatMoney(g.target_amount, currency)} · {pct}%</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {q.data?.length === 0 && (
          <Card className="col-span-full"><CardContent className="p-8 text-center text-sm text-muted-foreground">No goals yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
