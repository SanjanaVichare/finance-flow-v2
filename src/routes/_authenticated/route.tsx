import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Tags,
  Target,
  PiggyBank,
  FileBarChart,
  Settings,
  LogOut,
  Menu,
  Building2,
  Users,
  ShieldCheck,
  Activity,
  LogIn,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/admin.functions";
import { getActiveImpersonation, stopImpersonation } from "@/lib/super.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const mustReset = Boolean(data.user.user_metadata?.must_reset_password);
    if (mustReset && !location.pathname.startsWith("/first-login")) {
      throw redirect({ to: "/first-login" });
    }
    return { user: data.user };
  },
  component: AuthedLayout,
});

const companyNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/budgets", label: "Budgets", icon: PiggyBank },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const superNav = [
  { to: "/super/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/companies", label: "Companies", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/super/activity", label: "Activity Logs", icon: Activity },
] as const;

function Sidebar({ user, onNavigate, mode, isCompanyAdmin }: {
  user: User | null; onNavigate?: () => void;
  mode: "super" | "company"; isCompanyAdmin: boolean;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const items = mode === "super" ? superNav : companyNav;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Wallet className="h-4 w-4" />
        </div>
        <span className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          {mode === "super" ? "LedgerFlow · Admin" : "LedgerFlow"}
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {items.map((n) => {
          const active = pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}

        {mode === "company" && isCompanyAdmin && (
          <div className="pt-4">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Administration
            </div>
            <Link to="/admin/users" onClick={onNavigate}
              className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                pathname.startsWith("/admin/users")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground")}>
              <Users className="h-4 w-4" /> Users
            </Link>
          </div>
        )}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        {mode === "super" && (
          <div className="mb-2 flex items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 rounded bg-sidebar-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-sidebar-primary-foreground">
              <ShieldCheck className="h-3 w-3" /> Super Admin
            </span>
          </div>
        )}
        <div className="mb-3 text-xs text-sidebar-foreground/60 truncate">{user?.email}</div>
        <Button variant="secondary" size="sm" className="w-full gap-2" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}

function ImpersonationBanner({ name, onExit }: { name: string; onExit: () => void }) {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-warning/40 bg-warning/15 px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <LogIn className="h-4 w-4" />
        <span>
          You are viewing <span className="font-semibold">{name}</span> as its administrator.
        </span>
      </div>
      <Button variant="outline" size="sm" className="gap-1" onClick={onExit}>
        <X className="h-3.5 w-3.5" /> Exit
      </Button>
    </div>
  );
}

function AuthedLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const getProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["my-profile"], queryFn: () => getProfile(), staleTime: 60_000,
  });

  const getImp = useServerFn(getActiveImpersonation);
  const { data: imp } = useQuery({
    queryKey: ["active-impersonation"], queryFn: () => getImp(),
    enabled: Boolean(profile?.isSuperAdmin),
    staleTime: 30_000,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const isSuperAdmin = Boolean(profile?.isSuperAdmin);
  const isCompanyAdmin = (profile?.roles ?? []).some((r) => r.role === "company_admin");
  const isImpersonating = Boolean(imp?.active);
  const mode: "super" | "company" = isSuperAdmin && !isImpersonating ? "super" : "company";

  // Redirect super admin (not impersonating) landing on company dashboard
  useEffect(() => {
    if (isSuperAdmin && !isImpersonating && pathname === "/dashboard") {
      navigate({ to: "/super/dashboard", replace: true });
    }
  }, [isSuperAdmin, isImpersonating, pathname, navigate]);

  const stopImp = useServerFn(stopImpersonation);
  async function exitImpersonation() {
    try {
      await stopImp();
      await qc.invalidateQueries();
      toast.success("Exited company view");
      navigate({ to: "/super/dashboard", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-64 lg:flex-col">
        <Sidebar user={user} mode={mode} isCompanyAdmin={isCompanyAdmin} />
      </aside>
      <div className="lg:pl-64">
        {isImpersonating && imp?.active && (
          <ImpersonationBanner name={imp.active.companyName} onExit={exitImpersonation} />
        )}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground border-none">
              <Sidebar user={user} mode={mode} isCompanyAdmin={isCompanyAdmin}
                onNavigate={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-semibold">LedgerFlow</span>
        </header>
        <main className="px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
