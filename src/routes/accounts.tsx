import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { EmptyState } from "@/components/finance/EmptyState";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/lib/finance/store";
import { totalAssets, totalLiabilities, fmtCurrency } from "@/lib/finance/data";
import { Building2, CreditCard, Landmark, Wallet, TrendingUp, Home, Car, Trash2 } from "lucide-react";
import { AddAccountDialog } from "@/components/finance/AddDialogs";
import { useState } from "react";

export const Route = createFileRoute("/accounts")({
  head: () => ({ meta: [{ title: "Accounts — Noventrum" }] }),
  component: AccountsPage,
});

const ICONS: Record<string, typeof Building2> = {
  checking: Building2,
  savings: Landmark,
  credit: CreditCard,
  brokerage: TrendingUp,
  cash: Wallet,
  loan: Car,
  mortgage: Home,
};

function AccountsPage() {
  const accounts = useFinance((s) => s.accounts);
  const deleteAccount = useFinance((s) => s.deleteAccount);
  const [addOpen, setAddOpen] = useState(false);

  const grouped = accounts.reduce<Record<string, typeof accounts>>((acc, a) => {
    (acc[a.type] ||= []).push(a);
    return acc;
  }, {});

  return (
    <AppShell
      title="Accounts"
      subtitle={accounts.length ? `${accounts.length} accounts` : "Add your first account to get started"}
      actions={<AddAccountDialog open={addOpen} onOpenChange={setAddOpen} trigger={<Button size="sm">Add account</Button>} />}
    >
      {accounts.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="No accounts yet"
          description="Add checking, savings, credit cards, loans, brokerage — anything you'd like to track."
          action={{ label: "Add account", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total assets" value={totalAssets(accounts)} />
            <StatCard label="Total liabilities" value={totalLiabilities(accounts)} />
            <StatCard label="Net worth" value={totalAssets(accounts) - totalLiabilities(accounts)} />
            <StatCard label="Accounts" value={accounts.length} currency={false} />
          </div>

          {Object.entries(grouped).map(([type, list]) => {
            const Icon = ICONS[type] ?? Wallet;
            return (
              <div key={type} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold capitalize">{type}</h2>
                  <Badge variant="secondary">{list.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {list.map((a) => (
                    <Card key={a.id} className="p-5 gap-3 group relative">
                      <button
                        aria-label="Delete account"
                        onClick={() => deleteAccount(a.id)}
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div>
                        <div className="font-semibold">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{a.institution || "—"}</div>
                      </div>
                      <div className={"text-2xl font-semibold num " + (a.balance < 0 ? "text-destructive" : "")}>{fmtCurrency(a.balance)}</div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{a.currency}</span>
                        <span className="capitalize">{a.type}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </AppShell>
  );
}
