import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAllCompanies, listCompanyUsers, adminCreateUser, resetUserPassword,
  setUserActive, getMyProfile,
} from "@/lib/admin.functions";
import { useMyCompany } from "@/hooks/use-my-company";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Plus, KeyRound, Power } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const getProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: () => getProfile(), staleTime: 60_000 });
  const { data: myCompany } = useMyCompany();
  const isSuperAdmin = Boolean(profile?.isSuperAdmin);

  const listCompaniesFn = useServerFn(listAllCompanies);
  const { data: allCompanies } = useQuery({
    queryKey: ["all-companies"], queryFn: () => listCompaniesFn(),
    enabled: isSuperAdmin,
  });

  const companies = useMemo(() => {
    if (isSuperAdmin) return allCompanies ?? [];
    return myCompany?.company ? [myCompany.company] : [];
  }, [isSuperAdmin, allCompanies, myCompany]);

  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const effectiveCompanyId = companyId ?? companies[0]?.id;

  const listUsersFn = useServerFn(listCompanyUsers);
  const { data: users, isLoading } = useQuery({
    queryKey: ["company-users", effectiveCompanyId],
    queryFn: () => listUsersFn({ data: { companyId: effectiveCompanyId! } }),
    enabled: Boolean(effectiveCompanyId),
  });

  if (profile && !isSuperAdmin && !(profile.roles ?? []).some((r) => r.role === "company_admin")) {
    return <div className="text-sm text-muted-foreground">Company Admin access required.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Users
          </h1>
          <p className="text-sm text-muted-foreground">Provision and manage team members.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {companies.length > 1 && (
            <div className="w-64">
              <Select value={effectiveCompanyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {effectiveCompanyId && (
            <CreateUserDialog companyId={effectiveCompanyId} isSuperAdmin={isSuperAdmin} />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team members</CardTitle>
          <CardDescription>{users?.length ?? 0} in this company</CardDescription>
        </CardHeader>
        <CardContent>
          {!effectiveCompanyId ? (
            <div className="text-sm text-muted-foreground">Select a company to manage users.</div>
          ) : isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((u: any) => (
                  <UserRow key={u.id} u={u} companyId={effectiveCompanyId} />
                ))}
                {(users ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No users yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({ u, companyId }: { u: any; companyId: string }) {
  const qc = useQueryClient();
  const reset = useServerFn(resetUserPassword);
  const setActive = useServerFn(setUserActive);
  const [tempPw, setTempPw] = useState<string | null>(null);

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
        <TableCell className="text-sm">{u.email}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {(u.roles ?? []).map((r: string) => (
              <Badge key={r} variant="secondary" className="capitalize">{r.replace("_", " ")}</Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>
          {u.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Disabled</Badge>}
          {u.must_reset_password && <Badge variant="outline" className="ml-1">Pending reset</Badge>}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={async () => {
              const r = await reset({ data: { userId: u.id, companyId } });
              setTempPw(r.tempPassword);
              await qc.invalidateQueries({ queryKey: ["company-users", companyId] });
            }}>
              <KeyRound className="h-3.5 w-3.5 mr-1" /> Reset password
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              await setActive({ data: { userId: u.id, companyId, isActive: !u.is_active } });
              await qc.invalidateQueries({ queryKey: ["company-users", companyId] });
              toast.success(u.is_active ? "User disabled" : "User enabled");
            }}>
              <Power className="h-3.5 w-3.5 mr-1" /> {u.is_active ? "Disable" : "Enable"}
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {tempPw && (
        <TableRow>
          <TableCell colSpan={5}>
            <div className="rounded-md border bg-muted/40 p-3 text-sm flex items-center gap-2">
              <span className="text-muted-foreground">New temporary password for {u.email}:</span>
              <code className="rounded bg-background px-2 py-0.5 font-mono">{tempPw}</code>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                navigator.clipboard.writeText(tempPw); toast.success("Copied");
              }}><Copy className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setTempPw(null)}>Dismiss</Button>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function CreateUserDialog({ companyId, isSuperAdmin }: { companyId: string; isSuperAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", role: "employee" as "manager" | "employee" | "company_admin" });
  const [result, setResult] = useState<{ email: string; tempPassword: string | null; reusedExistingUser: boolean } | null>(null);
  const qc = useQueryClient();
  const create = useServerFn(adminCreateUser);

  const allowedRoles: Array<{ v: "manager" | "employee" | "company_admin"; label: string }> = isSuperAdmin
    ? [{ v: "company_admin", label: "Company Admin" }, { v: "manager", label: "Manager" }, { v: "employee", label: "Employee" }]
    : [{ v: "manager", label: "Manager" }, { v: "employee", label: "Employee" }];

  function close() {
    setOpen(false); setResult(null);
    setForm({ full_name: "", email: "", phone: "", role: "employee" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await create({ data: { companyId, ...form } });
      setResult({ email: r.email, tempPassword: r.tempPassword, reusedExistingUser: r.reusedExistingUser });
      await qc.invalidateQueries({ queryKey: ["company-users", companyId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); else setOpen(true); }}>
      <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New user</Button></DialogTrigger>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader><DialogTitle>User created</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {result.reusedExistingUser
                  ? "This email already had an account. It was added to the company; no temporary password was generated."
                  : "Share these credentials. The user must change their password on first login. This password will not be shown again."}
              </p>
              <div className="rounded-md border p-3 space-y-1 text-sm">
                <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{result.email}</span></div>
                {result.tempPassword && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Temp password:</span>
                    <code className="rounded bg-muted px-2 py-0.5 font-mono">{result.tempPassword}</code>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                      navigator.clipboard.writeText(result.tempPassword!); toast.success("Copied");
                    }}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter><Button onClick={close}>Done</Button></DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Full name *</Label>
                <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map((r) => <SelectItem key={r.v} value={r.v}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                A secure temporary password will be generated and shown once after creation.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create user"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
