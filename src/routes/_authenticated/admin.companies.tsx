import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  superCreateCompany, updateCompanyStatus, deleteCompanyById, getMyProfile,
} from "@/lib/admin.functions";
import { listCompaniesEnriched, startImpersonation } from "@/lib/super.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Power, LogIn, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/companies")({
  head: () => ({ meta: [{ title: "Companies — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminCompaniesPage,
});

function AdminCompaniesPage() {
  const getProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: () => getProfile(), staleTime: 60_000 });
  const listFn = useServerFn(listCompaniesEnriched);
  const { data: companies, isLoading } = useQuery({
    queryKey: ["all-companies-enriched"], queryFn: () => listFn(),
    enabled: Boolean(profile?.isSuperAdmin),
  });

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "personal" | "commercial">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (companies ?? []).filter((c: any) => {
      if (typeFilter !== "all" && c.company_type !== typeFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.admin?.email?.toLowerCase().includes(q) ||
        c.admin?.full_name?.toLowerCase().includes(q)
      );
    });
  }, [companies, query, typeFilter, statusFilter]);

  if (profile && !profile.isSuperAdmin) {
    return <div className="text-sm text-muted-foreground">Super Admin access required.</div>;
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-start justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Companies
          </h1>
          <p className="text-sm text-muted-foreground">Provision and manage every workspace on the platform.</p>
        </div>
        <CreateCompanyDialog />
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="gap-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">All companies</CardTitle>
              <CardDescription>{filtered.length} of {companies?.length ?? 0}</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search companies..."
                className="w-full pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="h-full overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[180px]">Name</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="min-w-[150px]">Owner / Admin</TableHead>
                    <TableHead className="w-[60px] text-right">Users</TableHead>
                    <TableHead className="w-[100px] text-right">Income</TableHead>
                    <TableHead className="w-[100px] text-right">Expense</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[100px]">Created</TableHead>
                    <TableHead className="w-[280px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c: any) => <CompanyRow key={c.id} c={c} />)}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                        No companies found matching your criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyRow({ c }: { c: any }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const setStatus = useServerFn(updateCompanyStatus);
  const del = useServerFn(deleteCompanyById);
  const startImp = useServerFn(startImpersonation);

  async function openAs() {
    try {
      await startImp({ data: { companyId: c.id } });
      await qc.invalidateQueries();
      toast.success(`Viewing as ${c.name}`);
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium truncate max-w-[160px]">{c.name}</div>
        <div className="text-xs text-muted-foreground truncate max-w-[160px]">{c.email ?? "—"}</div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize whitespace-nowrap">
          {c.company_type ?? "commercial"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-sm truncate max-w-[140px]">{c.admin?.full_name ?? "—"}</div>
        <div className="text-xs text-muted-foreground truncate max-w-[140px]">{c.admin?.email ?? "—"}</div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{c.activeUsers || 0}</TableCell>
      <TableCell className="text-right tabular-nums text-success whitespace-nowrap">
        {fmt(c.totalIncome, c.currency)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-destructive whitespace-nowrap">
        {fmt(c.totalExpense, c.currency)}
      </TableCell>
      <TableCell>
        <Badge variant={c.status === "active" ? "default" : "secondary"} className="whitespace-nowrap">
          {c.status}
        </Badge>
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap">
        {new Date(c.created_at).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1 h-8 px-3 text-xs whitespace-nowrap"
            onClick={openAs}
          >
            <LogIn className="h-3.5 w-3.5" /> Open
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-8 px-3 text-xs whitespace-nowrap"
            onClick={async () => {
              await setStatus({ data: { companyId: c.id, status: c.status === "active" ? "suspended" : "active" } });
              await qc.invalidateQueries({ queryKey: ["all-companies-enriched"] });
              toast.success(c.status === "active" ? "Suspended" : "Reactivated");
            }}
          >
            <Power className="h-3.5 w-3.5" />
            {c.status === "active" ? "Suspend" : "Activate"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 px-3"
            onClick={async () => {
              if (!confirm(`Delete ${c.name}? This is permanent.`)) return;
              await del({ data: { companyId: c.id } });
              await qc.invalidateQueries({ queryKey: ["all-companies-enriched"] });
              toast.success("Deleted");
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function fmt(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0
    }).format(n || 0);
  } catch {
    return String(n ?? 0);
  }
}

function CreateCompanyDialog() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ email: string; tempPassword: string | null; reusedExistingUser: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const create = useServerFn(superCreateCompany);

  const [company, setCompany] = useState({
    name: "", email: "", phone: "", address: "",
    currency: "INR",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
    gst_vat: "", logo_url: "",
    company_type: "commercial" as "personal" | "commercial",
  });
  const [admin, setAdmin] = useState({ full_name: "", email: "", phone: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await create({ data: { company, admin } });
      setResult({ email: res.admin.email, tempPassword: res.tempPassword, reusedExistingUser: res.reusedExistingUser });
      await qc.invalidateQueries({ queryKey: ["all-companies-enriched"] });
      toast.success("Company created successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create company");
    } finally { setBusy(false); }
  }

  function close() {
    setOpen(false); setResult(null);
    setCompany({
      name: "", email: "", phone: "", address: "", currency: "INR",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata", gst_vat: "", logo_url: "", company_type: "commercial"
    });
    setAdmin({ full_name: "", email: "", phone: "" });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New company
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Company Created Successfully</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {result.reusedExistingUser
                  ? "This admin email already had an account. It has been added to the new company; no temporary password was generated."
                  : "Share these credentials with the Company Admin. This password will not be shown again."}
              </p>
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20">Email:</span>
                  <span className="font-medium">{result.email}</span>
                </div>
                {result.tempPassword && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-20">Password:</span>
                    <code className="rounded bg-muted px-3 py-1 font-mono text-sm">{result.tempPassword}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(result.tempPassword!);
                        toast.success("Password copied");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <DialogHeader>
              <DialogTitle>Create New Company</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Company Details</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Company name *" value={company.name} onChange={(v) => setCompany({ ...company, name: v })} required />
                  <div className="space-y-2">
                    <Label>Company type *</Label>
                    <Select value={company.company_type} onValueChange={(v: any) => setCompany({ ...company, company_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">Personal Use</SelectItem>
                        <SelectItem value="commercial">Commercial Use</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Field label="Company email" type="email" value={company.email} onChange={(v) => setCompany({ ...company, email: v })} />
                  <Field label="Phone" value={company.phone} onChange={(v) => setCompany({ ...company, phone: v })} />
                  <Field label="GST / VAT" value={company.gst_vat} onChange={(v) => setCompany({ ...company, gst_vat: v })} />
                  <Field label="Address" value={company.address} onChange={(v) => setCompany({ ...company, address: v })} className="sm:col-span-2" />
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={company.currency} onValueChange={(v) => setCompany({ ...company, currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["INR", "USD", "EUR", "GBP", "AED", "SGD", "JPY", "AUD", "CAD"].map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Field label="Timezone" value={company.timezone} onChange={(v) => setCompany({ ...company, timezone: v })} />
                  <Field label="Logo URL" value={company.logo_url} onChange={(v) => setCompany({ ...company, logo_url: v })} className="sm:col-span-2" />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Initial Company Admin</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name *" value={admin.full_name} onChange={(v) => setAdmin({ ...admin, full_name: v })} required />
                  <Field label="Email *" type="email" value={admin.email} onChange={(v) => setAdmin({ ...admin, email: v })} required />
                  <Field label="Phone" value={admin.phone} onChange={(v) => setAdmin({ ...admin, phone: v })} />
                </div>
                <p className="text-xs text-muted-foreground">
                  A secure temporary password will be generated and shown once. The admin must change it on first login.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create company"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text", required, className }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; className?: string;
}) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label className="text-sm font-medium">{label}</Label>
      <Input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
    </div>
  );
}