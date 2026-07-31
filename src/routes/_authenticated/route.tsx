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
  Database,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/admin.functions";
import { getActiveImpersonation, stopImpersonation } from "@/lib/super.functions";
import { toast } from "sonner";

// ─── Color Palette ─────────────────────────────────────
const COLORS = {
  warmGold: "#FFD691",
  deepBlue: "#233A66",
  mutedGold: "#D7A859",
  softPink: "#FF6E80",
  white: "#FFFFFF",
  darkNavy: "#1A2A4A",
};

// ─── Scrollbar Styles ─────────────────────────────────
const scrollbarStyles = `
  /* Custom scrollbar for sidebar */
  .sidebar-scroll::-webkit-scrollbar {
    width: 5px;
    height: 5px;
  }
  .sidebar-scroll::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }
  .sidebar-scroll::-webkit-scrollbar-thumb {
    background: ${COLORS.warmGold};
    border-radius: 3px;
    transition: background 0.2s ease;
  }
  .sidebar-scroll::-webkit-scrollbar-thumb:hover {
    background: ${COLORS.mutedGold};
  }
  .sidebar-scroll {
    scrollbar-width: thin;
    scrollbar-color: ${COLORS.warmGold} rgba(255, 255, 255, 0.05);
  }

  /* Custom scrollbar for main content */
  .main-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .main-scroll::-webkit-scrollbar-track {
    background: #F8F6F0;
    border-radius: 3px;
  }
  .main-scroll::-webkit-scrollbar-thumb {
    background: ${COLORS.mutedGold};
    border-radius: 3px;
    transition: background 0.2s ease;
  }
  .main-scroll::-webkit-scrollbar-thumb:hover {
    background: ${COLORS.deepBlue};
  }
  .main-scroll {
    scrollbar-width: thin;
    scrollbar-color: ${COLORS.mutedGold} #F8F6F0;
  }
`;

// ─── Route ─────────────────────────────────────────────

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

// ─── Navigation Config ────────────────────────────────

const COMPANY_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/budgets", label: "Budgets", icon: PiggyBank },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/attendance", label: "Attendance", icon: CalendarDays },
  { to: "/dynamic", label: "Users", icon: Database },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const SUPER_NAV = [
  { to: "/super/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/companies", label: "Companies", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/attendance", label: "Attendance", icon: CalendarDays },
  { to: "/dynamic", label: "Users", icon: Database },
  { to: "/super/activity", label: "Activity Logs", icon: Activity },
] as const;

// ─── Sidebar ───────────────────────────────────────────

function Sidebar({
  user,
  onNavigate,
  mode,
  isCompanyAdmin,
  isCollapsed,
  onToggleCollapse,
}: {
  user: User | null;
  onNavigate?: () => void;
  mode: "super" | "company";
  isCompanyAdmin: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const navItems = mode === "super" ? SUPER_NAV : COMPANY_NAV;

  return (
    <div
      className={cn(
        "flex h-full flex-col transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )}
      style={{
        backgroundColor: COLORS.deepBlue,
        color: COLORS.white,
      }}
    >
      <SidebarHeader mode={mode} isCollapsed={isCollapsed} onToggleCollapse={onToggleCollapse} />

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto sidebar-scroll">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            label={item.label}
            icon={item.icon}
            isActive={pathname.startsWith(item.to)}
            onClick={onNavigate}
            isCollapsed={isCollapsed}
          />
        ))}

        {mode === "company" && isCompanyAdmin && (
          <AdminSection onNavigate={onNavigate} pathname={pathname} isCollapsed={isCollapsed} />
        )}
      </nav>

      <SidebarFooter user={user} onSignOut={handleSignOut} mode={mode} isCollapsed={isCollapsed} />
    </div>
  );
}

// ─── Sidebar Subcomponents ────────────────────────────

function SidebarHeader({
  mode,
  isCollapsed,
  onToggleCollapse
}: {
  mode: "super" | "company";
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <div
      className={cn(
        "flex h-16 items-center px-3",
        isCollapsed ? "justify-center" : "justify-between"
      )}
      style={{ borderColor: COLORS.mutedGold }}
    >
      {!isCollapsed ? (
        <>
          <div className="flex items-center gap-2">
            <div
              className="grid h-8 w-8 place-items-center rounded-md flex-shrink-0"
              style={{
                backgroundColor: COLORS.warmGold,
                color: COLORS.deepBlue,
              }}
            >
              <Wallet className="h-4 w-4" />
            </div>
            <span
              className="font-semibold truncate"
              style={{
                fontFamily: "var(--font-display)",
                color: COLORS.white,
              }}
            >
              {mode === "super" ? "LedgerFlow · Admin" : "LedgerFlow"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-white/10"
            style={{ color: COLORS.white }}
            onClick={onToggleCollapse}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-white/10"
          style={{ color: COLORS.white }}
          onClick={onToggleCollapse}
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  isActive,
  onClick,
  isCollapsed,
}: {
  to: string;
  label: string;
  icon: any;
  isActive: boolean;
  onClick?: () => void;
  isCollapsed: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        isCollapsed ? "justify-center" : ""
      )}
      style={{
        color: isActive ? COLORS.deepBlue : COLORS.warmGold,
        backgroundColor: isActive ? COLORS.warmGold : "transparent",
      }}
      title={isCollapsed ? label : undefined}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!isCollapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

function AdminSection({
  onNavigate,
  pathname,
  isCollapsed
}: {
  onNavigate?: () => void;
  pathname: string;
  isCollapsed: boolean;
}) {
  return (
    <div className="pt-4">
      {!isCollapsed && (
        <div
          className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: COLORS.mutedGold }}
        >
          Administration
        </div>
      )}
      <NavLink
        to="/admin/users"
        label="Admin Users"
        icon={Users}
        isActive={pathname.startsWith("/admin/users")}
        onClick={onNavigate}
        isCollapsed={isCollapsed}
      />
    </div>
  );
}

function SidebarFooter({
  user,
  onSignOut,
  mode,
  isCollapsed,
}: {
  user: User | null;
  onSignOut: () => void;
  mode: "super" | "company";
  isCollapsed: boolean;
}) {
  return (
    <div
      className="border-t p-4"
      style={{ borderColor: COLORS.mutedGold }}
    >
      {mode === "super" && (
        <div className={cn("mb-2", isCollapsed ? "flex justify-center" : "")}>
          <span className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
            isCollapsed ? "justify-center" : ""
          )}
            style={{
              backgroundColor: COLORS.softPink,
              color: COLORS.white,
            }}
          >
            <ShieldCheck className="h-3 w-3" />
            {!isCollapsed && "Super Admin"}
          </span>
        </div>
      )}
      {!isCollapsed && (
        <div
          className="mb-3 text-xs truncate"
          style={{ color: COLORS.mutedGold }}
        >
          {user?.email}
        </div>
      )}
      <Button
        variant="secondary"
        size={isCollapsed ? "icon" : "sm"}
        className={cn("gap-2", isCollapsed ? "w-full" : "w-full")}
        onClick={onSignOut}
        title={isCollapsed ? "Sign out" : undefined}
        style={{
          backgroundColor: COLORS.softPink,
          color: COLORS.white,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = COLORS.warmGold;
          e.currentTarget.style.color = COLORS.deepBlue;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = COLORS.softPink;
          e.currentTarget.style.color = COLORS.white;
        }}
      >
        <LogOut className="h-4 w-4" />
        {!isCollapsed && "Sign out"}
      </Button>
    </div>
  );
}

// ─── Impersonation Banner ─────────────────────────────

function ImpersonationBanner({ name, onExit }: { name: string; onExit: () => void }) {
  return (
    <div
      className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b px-4 py-2 text-sm"
      style={{
        backgroundColor: COLORS.warmGold,
        borderColor: COLORS.mutedGold,
        color: COLORS.deepBlue,
      }}
    >
      <div className="flex items-center gap-2">
        <LogIn className="h-4 w-4" style={{ color: COLORS.deepBlue }} />
        <span>
          You are viewing <span className="font-semibold">{name}</span> as its administrator.
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        style={{
          borderColor: COLORS.deepBlue,
          color: COLORS.deepBlue,
        }}
        onClick={onExit}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = COLORS.deepBlue;
          e.currentTarget.style.color = COLORS.white;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = COLORS.deepBlue;
        }}
      >
        <X className="h-3.5 w-3.5" /> Exit
      </Button>
    </div>
  );
}

// ─── Mobile Header ────────────────────────────────────

function MobileHeader({
  sheetOpen,
  setSheetOpen,
  user,
  mode,
  isCompanyAdmin
}: {
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  user: User | null;
  mode: "super" | "company";
  isCompanyAdmin: boolean;
}) {
  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur lg:hidden"
      style={{
        backgroundColor: "#F8F6F0",
        borderColor: COLORS.mutedGold,
      }}
    >
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" style={{ color: COLORS.deepBlue }} />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 border-none">
          <Sidebar
            user={user}
            mode={mode}
            isCompanyAdmin={isCompanyAdmin}
            isCollapsed={false}
            onToggleCollapse={() => { }}
            onNavigate={() => setSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>
      <span
        className="font-semibold"
        style={{ color: COLORS.deepBlue }}
      >
        LedgerFlow
      </span>
    </header>
  );
}

// ─── Main Layout ──────────────────────────────────────

function AuthedLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Persist collapse state in localStorage
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // ── Data ──
  const getProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getProfile(),
    staleTime: 60_000,
  });

  const getImp = useServerFn(getActiveImpersonation);
  const { data: imp } = useQuery({
    queryKey: ["active-impersonation"],
    queryFn: () => getImp(),
    enabled: Boolean(profile?.isSuperAdmin),
    staleTime: 30_000,
  });

  // ── Effects ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const isSuperAdmin = Boolean(profile?.isSuperAdmin);
  const isCompanyAdmin = (profile?.roles ?? []).some((r) => r.role === "company_admin");
  const isImpersonating = Boolean(imp?.active);
  const mode: "super" | "company" = isSuperAdmin && !isImpersonating ? "super" : "company";

  // Redirect super admin to their dashboard
  useEffect(() => {
    if (isSuperAdmin && !isImpersonating && pathname === "/dashboard") {
      navigate({ to: "/super/dashboard", replace: true });
    }
  }, [isSuperAdmin, isImpersonating, pathname, navigate]);

  // ── Handlers ──
  const stopImp = useServerFn(stopImpersonation);
  const handleExitImpersonation = async () => {
    try {
      await stopImp();
      await qc.invalidateQueries();
      toast.success("Exited company view");
      navigate({ to: "/super/dashboard", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // ── Render ──
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F8F6F0" }}>
      <style>{scrollbarStyles}</style>

      <DesktopSidebar
        user={user}
        mode={mode}
        isCompanyAdmin={isCompanyAdmin}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <div className={cn(
        "transition-all duration-300 ease-in-out",
        isCollapsed ? "lg:pl-16" : "lg:pl-64"
      )}>
        {isImpersonating && imp?.active && (
          <ImpersonationBanner
            name={imp.active.companyName}
            onExit={handleExitImpersonation}
          />
        )}

        <MobileHeader
          sheetOpen={sheetOpen}
          setSheetOpen={setSheetOpen}
          user={user}
          mode={mode}
          isCompanyAdmin={isCompanyAdmin}
        />

        <main className="px-4 py-6 lg:px-8 lg:py-8 main-scroll">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ─── Desktop Sidebar Wrapper ──────────────────────────

function DesktopSidebar({
  user,
  mode,
  isCompanyAdmin,
  isCollapsed,
  onToggleCollapse,
}: {
  user: User | null;
  mode: "super" | "company";
  isCompanyAdmin: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <aside className={cn(
      "hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:flex-col transition-all duration-300 ease-in-out",
      isCollapsed ? "lg:w-16" : "lg:w-64"
    )}>
      <Sidebar
        user={user}
        mode={mode}
        isCompanyAdmin={isCompanyAdmin}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
      />
    </aside>
  );
}