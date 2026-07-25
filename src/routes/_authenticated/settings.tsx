import { createFileRoute } from "@tanstack/react-router";
import { useMyCompany } from "@/hooks/use-my-company";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — LedgerFlow" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useMyCompany();
  const c = data?.company;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace details and roles.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Company</CardTitle><CardDescription>Workspace details.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Row label="Name" value={c?.name ?? "—"} />
          <Row label="Currency" value={c?.currency ?? "—"} />
          <Row label="Timezone" value={c?.timezone ?? "—"} />
          <Row label="Status" value={c?.status ?? "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your roles</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(data?.roles ?? []).map((r) => <Badge key={r} variant="secondary" className="capitalize">{r.replace("_", " ")}</Badge>)}
          {(!data?.roles || data.roles.length === 0) && <span className="text-sm text-muted-foreground">No roles.</span>}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
