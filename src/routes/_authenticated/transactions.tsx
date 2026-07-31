import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTransactions, createTransaction, deleteTransaction, listAccounts, listCategories } from "@/lib/finance.functions";
import { useMyCompany } from "@/hooks/use-my-company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney, todayISO } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transactions — LedgerFlow" }, { name: "robots", content: "noindex" }] }),
  component: TransactionsPage,
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
  .transactions-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .transactions-scroll::-webkit-scrollbar-track {
    background: ${COLORS.cream};
    border-radius: 3px;
  }
  .transactions-scroll::-webkit-scrollbar-thumb {
    background: ${COLORS.mutedGold};
    border-radius: 3px;
    transition: background 0.2s ease;
  }
  .transactions-scroll::-webkit-scrollbar-thumb:hover {
    background: ${COLORS.deepBlue};
  }
  .transactions-scroll {
    scrollbar-width: thin;
    scrollbar-color: ${COLORS.mutedGold} ${COLORS.cream};
  }
`;

function TransactionsPage() {
  const { data: my } = useMyCompany();
  const companyId = my?.company?.id;
  const currency = my?.company?.currency ?? "INR";

  const listTx = useServerFn(listTransactions);
  const listAcc = useServerFn(listAccounts);
  const listCat = useServerFn(listCategories);
  const create = useServerFn(createTransaction);
  const del = useServerFn(deleteTransaction);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense" | "transfer">("expense");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [occurredOn, setOccurredOn] = useState(todayISO());

  const accounts = useQuery({
    enabled: !!companyId, queryKey: ["accounts", companyId],
    queryFn: () => listAcc({ data: { companyId: companyId! } }),
  });
  const categories = useQuery({
    enabled: !!companyId, queryKey: ["categories", companyId],
    queryFn: () => listCat({ data: { companyId: companyId! } }),
  });
  const txns = useQuery({
    enabled: !!companyId, queryKey: ["transactions", companyId],
    queryFn: () => listTx({ data: { companyId: companyId!, limit: 200 } }),
  });

  const submit = useMutation({
    mutationFn: () => create({
      data: {
        companyId: companyId!, accountId, toAccountId: type === "transfer" ? toAccountId : null,
        categoryId: type === "transfer" ? null : (categoryId || null),
        type, amount: Number(amount), description, vendor, paymentMethod: paymentMethod as any, occurredOn,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      qc.invalidateQueries({ queryKey: ["accounts", companyId] });
      qc.invalidateQueries({ queryKey: ["dashboard", companyId] });
      toast.success("Recorded");
      setOpen(false); setAmount(""); setDescription(""); setVendor("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id, companyId: companyId! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      qc.invalidateQueries({ queryKey: ["accounts", companyId] });
      qc.invalidateQueries({ queryKey: ["dashboard", companyId] });
      toast.success("Deleted");
    },
  });

  const relevantCategories = (categories.data ?? []).filter((c) => c.group === (type === "income" ? "income" : "expense"));

  if (!companyId) return <div className="text-muted-foreground">Create a workspace first.</div>;

  return (
    <div className="space-y-6 transactions-scroll" style={{ backgroundColor: COLORS.cream }}>
      <style>{scrollbarStyles}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)", color: COLORS.deepBlue }}>
            Transactions
          </h1>
          <p className="text-sm" style={{ color: COLORS.mutedGold }}>
            Record income, expenses, and transfers.
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
              <Plus className="h-4 w-4" /> New transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
            <DialogHeader>
              <DialogTitle style={{ color: COLORS.deepBlue }}>New transaction</DialogTitle>
            </DialogHeader>

            <Tabs value={type} onValueChange={(v) => setType(v as any)}>
              <TabsList className="grid w-full grid-cols-3" style={{ backgroundColor: COLORS.cream }}>
                <TabsTrigger
                  value="expense"
                  className="data-[state=active]:bg-deepBlue data-[state=active]:text-white"
                  style={{
                    color: COLORS.deepBlue,
                  }}
                >
                  Expense
                </TabsTrigger>
                <TabsTrigger
                  value="income"
                  className="data-[state=active]:bg-deepBlue data-[state=active]:text-white"
                  style={{
                    color: COLORS.deepBlue,
                  }}
                >
                  Income
                </TabsTrigger>
                <TabsTrigger
                  value="transfer"
                  className="data-[state=active]:bg-deepBlue data-[state=active]:text-white"
                  style={{
                    color: COLORS.deepBlue,
                  }}
                >
                  Transfer
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2 col-span-2">
                <Label style={{ color: COLORS.deepBlue }}>Amount ({currency})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="focus:border-mutedGold focus:ring-mutedGold"
                  style={{ borderColor: COLORS.mutedGold }}
                />
              </div>

              <div className="space-y-2">
                <Label style={{ color: COLORS.deepBlue }}>{type === "transfer" ? "From account" : "Account"}</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="focus:border-mutedGold focus:ring-mutedGold" style={{ borderColor: COLORS.mutedGold }}>
                    <SelectValue placeholder="Choose account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.data?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {type === "transfer" ? (
                <div className="space-y-2">
                  <Label style={{ color: COLORS.deepBlue }}>To account</Label>
                  <Select value={toAccountId} onValueChange={setToAccountId}>
                    <SelectTrigger className="focus:border-mutedGold focus:ring-mutedGold" style={{ borderColor: COLORS.mutedGold }}>
                      <SelectValue placeholder="Choose account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.data?.filter((a) => a.id !== accountId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label style={{ color: COLORS.deepBlue }}>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="focus:border-mutedGold focus:ring-mutedGold" style={{ borderColor: COLORS.mutedGold }}>
                      <SelectValue placeholder="Choose category" />
                    </SelectTrigger>
                    <SelectContent>
                      {relevantCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label style={{ color: COLORS.deepBlue }}>Payment method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="focus:border-mutedGold focus:ring-mutedGold" style={{ borderColor: COLORS.mutedGold }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["cash", "upi", "card", "bank", "other"].map((p) => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label style={{ color: COLORS.deepBlue }}>Date</Label>
                <Input
                  type="date"
                  value={occurredOn}
                  onChange={(e) => setOccurredOn(e.target.value)}
                  className="focus:border-mutedGold focus:ring-mutedGold"
                  style={{ borderColor: COLORS.mutedGold }}
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label style={{ color: COLORS.deepBlue }}>Vendor / Person</Label>
                <Input
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="Optional"
                  className="focus:border-mutedGold focus:ring-mutedGold"
                  style={{ borderColor: COLORS.mutedGold }}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label style={{ color: COLORS.deepBlue }}>Note</Label>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="focus:border-mutedGold focus:ring-mutedGold"
                  style={{ borderColor: COLORS.mutedGold }}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => submit.mutate()}
                disabled={submit.isPending || !accountId || !amount || (type === "transfer" && !toAccountId)}
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

      <Card style={{ backgroundColor: COLORS.white, borderColor: COLORS.mutedGold }}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: COLORS.cream }}>
                <TableHead style={{ color: COLORS.deepBlue, fontWeight: "600" }}>Date</TableHead>
                <TableHead style={{ color: COLORS.deepBlue, fontWeight: "600" }}>Description</TableHead>
                <TableHead style={{ color: COLORS.deepBlue, fontWeight: "600" }}>Category</TableHead>
                <TableHead style={{ color: COLORS.deepBlue, fontWeight: "600" }}>Account</TableHead>
                <TableHead className="text-right" style={{ color: COLORS.deepBlue, fontWeight: "600" }}>Amount</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(txns.data ?? []).map((t) => (
                <TableRow key={t.id} className="hover:bg-cream/50" style={{ borderColor: COLORS.cream }}>
                  <TableCell style={{ color: COLORS.mutedGold }}>{t.occurred_on}</TableCell>
                  <TableCell>
                    <div className="font-medium" style={{ color: COLORS.deepBlue }}>
                      {t.description || t.vendor || "—"}
                    </div>
                    {t.vendor && t.description && (
                      <div className="text-xs" style={{ color: COLORS.mutedGold }}>
                        {t.vendor}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm" style={{ color: COLORS.deepBlue }}>
                    {(t.category as unknown as { name?: string } | null)?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm" style={{ color: COLORS.deepBlue }}>
                    {(t.account as unknown as { name?: string } | null)?.name}
                  </TableCell>
                  <TableCell className={`text-right tabular font-medium ${t.type === "income" ? "text-deepBlue" :
                      t.type === "expense" ? "text-softPink" : ""
                    }`}>
                    {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}
                    {formatMoney(t.amount, currency)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove.mutate(t.id)}
                      style={{ color: COLORS.softPink }}
                      className="hover:bg-pink-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!txns.data || txns.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm" style={{ color: COLORS.mutedGold }}>
                    No transactions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}