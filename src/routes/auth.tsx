import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — LedgerFlow" },
      { name: "description", content: "Sign in to LedgerFlow." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    const mustReset = Boolean(data.user?.user_metadata?.must_reset_password);
    toast.success("Signed in");
    navigate({ to: mustReset ? "/first-login" : "/dashboard" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Wallet className="h-4 w-4" />
          </div>
          <span className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>LedgerFlow</span>
        </Link>
        <div>
          <h2 className="text-3xl font-semibold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            Your business finance,<br />in one clean ledger.
          </h2>
          <p className="mt-4 text-sidebar-foreground/70 max-w-md">
            Accounts are provisioned by your administrator. Contact them for access.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© LedgerFlow</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-border/60 shadow-[var(--shadow-elev)]">
          <CardHeader>
            <CardTitle className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>Sign in</CardTitle>
            <CardDescription>Use the credentials provided by your administrator.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Login"}
              </Button>
            </form>
            <p className="mt-6 text-xs text-muted-foreground text-center">
              Access is by administrator invite only. Contact your Company Admin or Super Admin if you need an account.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
