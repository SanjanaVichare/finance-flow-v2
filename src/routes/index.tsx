import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Building2, Lock, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              LedgerFlow
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#modules" className="hover:text-foreground">Modules</a>
            <a href="#security" className="hover:text-foreground">Security</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>

          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pt-20 pb-24">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Multi-tenant · Role-based · Audit-ready
          </div>
          <h1
            className="mt-6 text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            The finance operating <span className="text-accent">platform</span> for modern teams.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Track every rupee across accounts, budgets, and goals. Built for individuals, startups,
            NGOs, and companies — with role-based access and a data model ready for invoicing, payroll,
            and inventory.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to="/auth">Sign in <ArrowRight className="h-4 w-4" /></Link>

            </Button>
            <Button asChild variant="outline" size="lg"><a href="#features">See features</a></Button>
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            { icon: BarChart3, title: "Live dashboards", body: "Income, expenses, profit and top categories update the moment a transaction is logged." },
            { icon: Building2, title: "Multi-company", body: "Full data isolation between organizations with Super Admin oversight across tenants." },
            { icon: Lock, title: "Role-based access", body: "Admins, managers, and employees each see exactly what they should — enforced in the database." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elev)]">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="modules" className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Everything a growing team needs
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              "Multi-account · Cash, Bank, UPI, Wallet, Cards",
              "Transactions · Income, expense, transfer",
              "Budgets · Monthly limits & warnings",
              "Goals · Savings and revenue targets",
              "Reports · Daily · Weekly · Monthly · Yearly",
              "Audit log · Full activity trail",
              "Notifications · Budget & goal alerts",
              "Ready for invoicing, payroll, inventory",
            ].map((line) => (
              <div key={line} className="rounded-xl border border-border bg-card p-5 text-sm">
                {line}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} LedgerFlow. Built for finance teams.
      </footer>
    </div>
  );
}
