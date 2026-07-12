import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  Receipt,
  LineChart,
  Briefcase,
  CandlestickChart,
  PiggyBank,
  Wallet,
  Target,
  FileBarChart,
  Settings,
  Moon,
  Sun,
  Search,
  Bell,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AddMenu } from "@/components/finance/AddDialogs";
import { KommenszlapfAccountButton, KommenszlapfAccountDialog } from "@/components/auth/KommenszlapfAccount";


const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/net-worth", label: "Net Worth", icon: TrendingUp },
  { to: "/income", label: "Income", icon: ArrowDownCircle },
  { to: "/expenses", label: "Expenses", icon: ArrowUpCircle },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/investments", label: "Investments", icon: LineChart },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/markets", label: "Markets", icon: CandlestickChart },
  { to: "/budget", label: "Budget", icon: PiggyBank },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("noventrum-theme");
    const initial = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(initial);
    document.documentElement.classList.toggle("dark", initial);
  }, []);
  const toggle = () => {
    setDark((d) => {
      const nd = !d;
      document.documentElement.classList.toggle("dark", nd);
      localStorage.setItem("noventrum-theme", nd ? "dark" : "light");
      return nd;
    });
  };
  return { dark, toggle };
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <div className="hidden md:block h-9 w-[168px] rounded-md bg-muted/40" aria-hidden />;
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const date = now.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <div className="hidden md:flex flex-col items-end px-3 py-1 rounded-md bg-muted/40 border border-border/50 font-mono text-[11px] leading-tight">
      <span className="text-foreground font-medium">{time}</span>
      <span className="text-muted-foreground">{date}</span>
    </div>
  );
}

export function AppShell({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { dark, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="min-h-dvh flex w-full bg-background text-foreground">
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-40 h-dvh w-64 shrink-0 border-r border-sidebar-border bg-sidebar transition-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-16 items-center gap-2 px-5 border-b border-sidebar-border">
          <span className="text-xs font-medium uppercase tracking-widest text-sidebar-foreground/60">Navigation</span>
        </div>
        <nav className="p-3 space-y-0.5 overflow-y-auto h-[calc(100dvh-4rem)]">
          {NAV.map((n) => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
          </Button>

          <div className="relative group flex items-center">
            <Link to="/" className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60 transition-colors" aria-label="Noventrum home">
              <img src={logoAsset.url} alt="Noventrum logo" className="h-8 w-8 rounded-md object-contain" />
              <span className="font-semibold tracking-tight text-lg">Noventrum</span>
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="ml-1 hidden group-hover:inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Reload"
              type="button"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <div className="invisible group-hover:visible absolute left-0 top-full mt-1 min-w-[260px] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-1 z-50">
              <a
                href="https://kommenszlapf.website"
                className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                <span>Return to kommenszlapf.website</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>
              <Link
                to="/guide"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                Guide
              </Link>
            </div>
          </div>

          <Clock />

          <div className="hidden md:flex items-center gap-2 flex-1 max-w-md ml-2">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search transactions, tickers, accounts…" className="pl-9 h-9 bg-muted/40 border-transparent" />
            </div>
          </div>
          <div className="flex-1 md:hidden" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <AddMenu />
            <KommenszlapfAccountButton onOpen={() => setAccountOpen(true)} />
          </div>
        </header>
        <KommenszlapfAccountDialog open={accountOpen} onOpenChange={setAccountOpen} />

        <div className="flex-1 min-w-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1600px] mx-auto w-full">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight truncate">{title}</h1>
                {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
