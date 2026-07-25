import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCategories, createCategory, deleteCategory } from "@/lib/finance.functions";
import { useMyCompany } from "@/hooks/use-my-company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "Categories — LedgerFlow" }, { name: "robots", content: "noindex" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { data: my } = useMyCompany();
  const companyId = my?.company?.id;
  const list = useServerFn(listCategories);
  const create = useServerFn(createCategory);
  const del = useServerFn(deleteCategory);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState<"income" | "expense">("expense");

  const q = useQuery({
    enabled: !!companyId,
    queryKey: ["categories", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
  });

  const add = useMutation({
    mutationFn: () => create({ data: { companyId: companyId!, name, group } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories", companyId] });
      toast.success("Added"); setOpen(false); setName("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories", companyId] }); toast.success("Deleted"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const income = q.data?.filter((c) => c.group === "income") ?? [];
  const expense = q.data?.filter((c) => c.group === "expense") ?? [];

  if (!companyId) return <div className="text-muted-foreground">Create a workspace first.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Categories</h1>
          <p className="text-sm text-muted-foreground">Organize income and expense.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New category</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Group</Label>
                <Select value={group} onValueChange={(v) => setGroup(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={() => add.mutate()} disabled={!name || add.isPending}>Add</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {[{ title: "Income", items: income, badge: "success" }, { title: "Expense", items: expense, badge: "destructive" }].map((section) => (
          <Card key={section.title}>
            <CardHeader><CardTitle className="text-base">{section.title}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {section.items.map((c) => (
                  <Badge key={c.id} variant="secondary" className="gap-2 py-2 px-3 rounded-full">
                    {c.name}
                    <button onClick={() => remove.mutate(c.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {section.items.length === 0 && <div className="text-sm text-muted-foreground">None yet.</div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
