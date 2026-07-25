import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAccounts, upsertAccount, deleteAccount } from "@/lib/finance.functions";
import { useMyCompany } from "@/hooks/use-my-company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { Plus, Trash2, Wallet, Landmark, Smartphone, CreditCard, Coins } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Accounts — LedgerFlow" }, { name: "robots", content: "noindex" }] }),
  component: AccountsPage,
});

const ICONS: Record<string, React.ElementType> = {
  cash: Coins, bank: Landmark, wallet: Wallet, upi: Smartphone, credit_card: CreditCard,
};
const LABELS: Record<string, string> = {
  cash: "Cash", bank: "Bank", wallet: "Wallet", upi: "UPI", credit_card: "Credit Card",
};

function AccountsPage() {
  const { data: my } = useMyCompany();
  const companyId = my?.company?.id;
  const currency = my?.company?.currency ?? "INR";
  const list = useServerFn(listAccounts);
  const upsert = useServerFn(upsertAccount);
  const del = useServerFn(deleteAccount);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("bank");
  const [opening, setOpening] = useState(0);

  const q = useQuery({
    enabled: !!companyId,
    queryKey: ["accounts", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
  });

  const create = useMutation({
    mutationFn: () => upsert({ data: { companyId: companyId!, name, type: type as any, openingBalance: Number(opening) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts", companyId] });
      qc.invalidateQueries({ queryKey: ["dashboard", companyId] });
      toast.success("Account created");
      setOpen(false); setName(""); setType("bank"); setOpening(0);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounts", companyId] }); toast.success("Deleted"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!companyId) return <div className="text-muted-foreground">Create a workspace first.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Accounts</h1>
          <p className="text-sm text-muted-foreground">Cash, bank, UPI, wallets, and cards.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New account</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New account</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="HDFC Current" /></div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LABELS).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Opening balance</Label><Input type="number" step="0.01" value={opening} onChange={(e) => setOpening(Number(e.target.value))} /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {q.data?.map((a) => {
          const Icon = ICONS[a.type as string] ?? Wallet;
          return (
            <Card key={a.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                  <div>
                    <CardTitle className="text-base">{a.name}</CardTitle>
                    <div className="text-xs text-muted-foreground">{LABELS[a.type as string]}</div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular" style={{ fontFamily: "var(--font-display)" }}>
                  {formatMoney(a.current_balance, currency)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Opening {formatMoney(a.opening_balance, currency)}</div>
              </CardContent>
            </Card>
          );
        })}
        {q.data?.length === 0 && (
          <Card className="col-span-full"><CardContent className="p-8 text-center text-sm text-muted-foreground">No accounts yet. Add one to start recording transactions.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
