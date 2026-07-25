import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRecentActivity } from "@/lib/super.functions";
import { getMyProfile } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/super/activity")({
  head: () => ({ meta: [{ title: "Activity — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: SuperActivity,
});

function SuperActivity() {
  const profileFn = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn(), staleTime: 60_000 });
  const fn = useServerFn(listRecentActivity);
  const { data } = useQuery({
    queryKey: ["recent-activity"], queryFn: () => fn(),
    enabled: Boolean(profile?.isSuperAdmin),
  });

  if (profile && !profile.isSuperAdmin) {
    return <div className="text-sm text-muted-foreground">Super Admin access required.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Activity Log
        </h1>
        <p className="text-sm text-muted-foreground">Recent audit events across every company.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Events</CardTitle><CardDescription>{data?.length ?? 0} entries</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                  <TableCell className="font-medium">{a.action}</TableCell>
                  <TableCell className="text-xs">{a.table_name ?? "—"} · {a.record_id?.slice(0, 8) ?? "—"}</TableCell>
                  <TableCell className="text-xs">{a.company_id?.slice(0, 8) ?? "—"}</TableCell>
                  <TableCell className="text-xs">{a.user_id?.slice(0, 8) ?? "—"}</TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No activity yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
