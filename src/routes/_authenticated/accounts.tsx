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
  .accounts-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .accounts-scroll::-webkit-scrollbar-track {
    background: ${COLORS.cream};
    border-radius: 3px;
  }
  .accounts-scroll::-webkit-scrollbar-thumb {
    background: ${COLORS.mutedGold};
    border-radius: 3px;
    transition: background 0.2s ease;
  }
  .accounts-scroll::-webkit-scrollbar-thumb:hover {
    background: ${COLORS.deepBlue};
  }
  .accounts-scroll {
    scrollbar-width: thin;
    scrollbar-color: ${COLORS.mutedGold} ${COLORS.cream};
  }
`;

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
    <div className="space-y-6 accounts-scroll" style={{ backgroundColor: COLORS.cream }}>
      <style>{scrollbarStyles}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)", color: COLORS.deepBlue }}>
            Accounts
          </h1>
          <p className="text-sm" style={{ color: COLORS.mutedGold }}>
            Cash, bank, UPI, wallets, and cards.
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
              <Plus className="h-4 w-4" /> New account
            </Button>
          </DialogTrigger>
          <DialogContent style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
            <DialogHeader>
              <DialogTitle style={{ color: COLORS.deepBlue }}>New account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label style={{ color: COLORS.deepBlue }}>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="HDFC Current"
                  className="focus:border-mutedGold focus:ring-mutedGold"
                  style={{ borderColor: COLORS.mutedGold }}
                />
              </div>
              <div className="space-y-2">
                <Label style={{ color: COLORS.deepBlue }}>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="focus:border-mutedGold focus:ring-mutedGold" style={{ borderColor: COLORS.mutedGold }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label style={{ color: COLORS.deepBlue }}>Opening balance</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={opening}
                  onChange={(e) => setOpening(Number(e.target.value))}
                  className="focus:border-mutedGold focus:ring-mutedGold"
                  style={{ borderColor: COLORS.mutedGold }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => create.mutate()}
                disabled={!name || create.isPending}
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
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {q.data?.map((a) => {
          const Icon = ICONS[a.type as string] ?? Wallet;
          return (
            <Card key={a.id} style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
              <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-9 w-9 place-items-center rounded-md"
                    style={{
                      backgroundColor: COLORS.warmGold,
                      color: COLORS.deepBlue,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base" style={{ color: COLORS.deepBlue }}>{a.name}</CardTitle>
                    <div className="text-xs" style={{ color: COLORS.mutedGold }}>{LABELS[a.type as string]}</div>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove.mutate(a.id)}
                  style={{ color: COLORS.softPink }}
                  className="hover:bg-pink-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div
                  className="text-2xl font-semibold tabular"
                  style={{ fontFamily: "var(--font-display)", color: COLORS.deepBlue }}
                >
                  {formatMoney(a.current_balance, currency)}
                </div>
                <div className="text-xs mt-1" style={{ color: COLORS.mutedGold }}>
                  Opening {formatMoney(a.opening_balance, currency)}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {q.data?.length === 0 && (
          <Card className="col-span-full" style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
            <CardContent className="p-8 text-center text-sm" style={{ color: COLORS.mutedGold }}>
              No accounts yet. Add one to start recording transactions.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}