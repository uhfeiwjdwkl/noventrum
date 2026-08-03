import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, AlertTriangle, Target, PiggyBank, TrendingUp, RefreshCw, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFinance } from "@/lib/finance/store";
import { fmtCurrency, fmtPct, describeRule } from "@/lib/finance/data";

type Alert = {
  id: string;
  title: string;
  detail: string;
  to: string;
  tone: "warn" | "info" | "good";
  icon: React.ComponentType<{ className?: string }>;
};

const DISMISS_KEY = "noventrum-dismissed-alerts";

function daysUntil(date: string) {
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86_400_000);
}

/** Live, data-driven alerts — budgets, goals, recurring rules and big movers. */
export function useAlerts(): Alert[] {
  const budgets = useFinance((s) => s.budgets);
  const goals = useFinance((s) => s.goals);
  const accounts = useFinance((s) => s.accounts);
  const holdings = useFinance((s) => s.holdings);
  const rules = useFinance((s) => s.recurringRules);

  return useMemo(() => {
    const out: Alert[] = [];

    for (const b of budgets) {
      const pct = b.limit > 0 ? (b.spent / b.limit) * 100 : 0;
      if (pct >= 100) {
        out.push({
          id: `budget-over-${b.id}`,
          title: `${b.category} budget exceeded`,
          detail: `${fmtCurrency(b.spent)} spent of ${fmtCurrency(b.limit)}`,
          to: "/budget",
          tone: "warn",
          icon: PiggyBank,
        });
      } else if (pct >= 80) {
        out.push({
          id: `budget-near-${b.id}-${Math.round(pct)}`,
          title: `${b.category} budget at ${Math.round(pct)}%`,
          detail: `${fmtCurrency(b.limit - b.spent)} left this month`,
          to: "/budget",
          tone: "info",
          icon: PiggyBank,
        });
      }
    }

    for (const g of goals) {
      const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
      const d = daysUntil(g.deadline);
      if (pct >= 100) {
        out.push({
          id: `goal-done-${g.id}`,
          title: `${g.name} reached`,
          detail: `${fmtCurrency(g.current)} of ${fmtCurrency(g.target)}`,
          to: "/goals",
          tone: "good",
          icon: Target,
        });
      } else if (d >= 0 && d <= 30) {
        out.push({
          id: `goal-due-${g.id}`,
          title: `${g.name} due in ${d} day${d === 1 ? "" : "s"}`,
          detail: `${fmtCurrency(Math.max(0, g.target - g.current))} still to save`,
          to: "/goals",
          tone: "warn",
          icon: Target,
        });
      }
    }

    for (const a of accounts) {
      if ((a.type === "checking" || a.type === "savings" || a.type === "cash") && a.balance < 0) {
        out.push({
          id: `overdrawn-${a.id}`,
          title: `${a.name} is overdrawn`,
          detail: fmtCurrency(a.balance, { currency: a.currency }),
          to: "/accounts",
          tone: "warn",
          icon: AlertTriangle,
        });
      }
    }

    for (const h of holdings) {
      if (Math.abs(h.dayChangePct) >= 5) {
        out.push({
          id: `mover-${h.symbol}-${new Date().toISOString().slice(0, 10)}`,
          title: `${h.symbol} moved ${fmtPct(h.dayChangePct)} today`,
          detail: `${fmtCurrency(h.price, { currency: h.currency })} · ${h.shares} held`,
          to: "/investments",
          tone: h.dayChangePct >= 0 ? "good" : "warn",
          icon: TrendingUp,
        });
      }
    }

    const active = rules.filter((r) => r.active);
    if (active.length) {
      out.push({
        id: `recurring-${active.length}`,
        title: `${active.length} recurring rule${active.length === 1 ? "" : "s"} running`,
        detail: active.map((r) => `${r.template.merchant} ${describeRule(r)}`).slice(0, 3).join(" · "),
        to: "/transactions",
        tone: "info",
        icon: RefreshCw,
      });
    }

    return out;
  }, [budgets, goals, accounts, holdings, rules]);
}

export function NotificationsMenu() {
  const alerts = useAlerts();
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]"));
    } catch {
      setDismissed([]);
    }
  }, []);

  const visible = alerts.filter((a) => !dismissed.includes(a.id));

  function dismissAll() {
    const ids = Array.from(new Set([...dismissed, ...alerts.map((a) => a.id)]));
    setDismissed(ids);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {visible.length > 0 && (
            <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 font-semibold">
              {visible.length > 9 ? "9+" : visible.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium">Notifications</span>
          {visible.length > 0 && (
            <button
              type="button"
              onClick={dismissAll}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </div>
          ) : (
            visible.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.id}
                  to={a.to}
                  className="flex gap-3 px-3 py-2.5 hover:bg-muted/60 border-b border-border/50 last:border-0"
                >
                  <span
                    className={
                      "mt-0.5 h-7 w-7 shrink-0 rounded-md grid place-items-center " +
                      (a.tone === "warn"
                        ? "bg-destructive/10 text-destructive"
                        : a.tone === "good"
                          ? "bg-success/10 text-success"
                          : "bg-accent text-primary")
                    }
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{a.title}</span>
                    <span className="block text-xs text-muted-foreground truncate">{a.detail}</span>
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
