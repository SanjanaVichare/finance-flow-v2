import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { completeFirstLoginReset } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/first-login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set your password — LedgerFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: FirstLoginPage,
});

function FirstLoginPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const reset = useServerFn(completeFirstLoginReset);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== pw2) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      await reset({ data: { newPassword: pw } });
      // Refresh local session metadata
      await supabase.auth.refreshSession();
      toast.success("Password updated");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle style={{ fontFamily: "var(--font-display)" }}>Set a new password</CardTitle>
          <CardDescription>
            Your account uses a temporary password. Choose a new password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw">New password</Label>
              <Input id="pw" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw2">Confirm password</Label>
              <Input id="pw2" type="password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Updating…" : "Update password & continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
