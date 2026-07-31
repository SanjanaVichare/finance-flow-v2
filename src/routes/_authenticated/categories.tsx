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
import { Plus, Trash2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "Categories — LedgerFlow" }, { name: "robots", content: "noindex" }] }),
  component: CategoriesPage,
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
  .categories-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .categories-scroll::-webkit-scrollbar-track {
    background: ${COLORS.cream};
    border-radius: 3px;
  }
  .categories-scroll::-webkit-scrollbar-thumb {
    background: ${COLORS.mutedGold};
    border-radius: 3px;
    transition: background 0.2s ease;
  }
  .categories-scroll::-webkit-scrollbar-thumb:hover {
    background: ${COLORS.deepBlue};
  }
  .categories-scroll {
    scrollbar-width: thin;
    scrollbar-color: ${COLORS.mutedGold} ${COLORS.cream};
  }
`;

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
    <div className="space-y-6 categories-scroll" style={{ backgroundColor: COLORS.cream }}>
      <style>{scrollbarStyles}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)", color: COLORS.deepBlue }}>
            Categories
          </h1>
          <p className="text-sm" style={{ color: COLORS.mutedGold }}>
            Organize income and expense.
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
              <Plus className="h-4 w-4" /> New category
            </Button>
          </DialogTrigger>
          <DialogContent style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
            <DialogHeader>
              <DialogTitle style={{ color: COLORS.deepBlue }}>New category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label style={{ color: COLORS.deepBlue }}>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="focus:border-mutedGold focus:ring-mutedGold"
                  style={{ borderColor: COLORS.mutedGold }}
                />
              </div>
              <div className="space-y-2">
                <Label style={{ color: COLORS.deepBlue }}>Group</Label>
                <Select value={group} onValueChange={(v) => setGroup(v as any)}>
                  <SelectTrigger className="focus:border-mutedGold focus:ring-mutedGold" style={{ borderColor: COLORS.mutedGold }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => add.mutate()}
                disabled={!name || add.isPending}
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
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {[
          { title: "Income", items: income, icon: ArrowUpCircle, iconColor: COLORS.deepBlue },
          { title: "Expense", items: expense, icon: ArrowDownCircle, iconColor: COLORS.softPink }
        ].map((section) => (
          <Card key={section.title} style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base" style={{ color: COLORS.deepBlue }}>
                <section.icon className="h-5 w-5" style={{ color: section.iconColor }} />
                {section.title}
                <Badge
                  className="ml-auto"
                  style={{
                    backgroundColor: COLORS.warmGold,
                    color: COLORS.deepBlue,
                  }}
                >
                  {section.items.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {section.items.map((c) => (
                  <Badge
                    key={c.id}
                    className="gap-2 py-2 px-3 rounded-full"
                    style={{
                      backgroundColor: COLORS.cream,
                      color: COLORS.deepBlue,
                    }}
                  >
                    {c.name}
                    <button
                      onClick={() => remove.mutate(c.id)}
                      className="hover:text-softPink transition-colors"
                      style={{ color: COLORS.mutedGold }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {section.items.length === 0 && (
                  <div className="text-sm" style={{ color: COLORS.mutedGold }}>
                    None yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}