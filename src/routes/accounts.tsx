import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { accounts, totalAssets, totalLiabilities, fmtCurrency } from "@/lib/finance/data";
import { Building2, CreditCard, Landmark, Wallet, TrendingUp, Home, Car } from "lucide-react";

export const Route = createFileRoute("/accounts")({
  head: () => ({ meta: [{ title: "Accounts — FinFlow" }] }),
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
  const grouped = accounts.reduce<Record<string, typeof accounts>>((acc, a) => {
    (acc[a.type] ||= []).push(a);
    return acc;
  }, {});

  return (
    <AppShell title="Accounts" subtitle={`${accounts.length} accounts connected`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total assets" value={totalAssets()} />
        <StatCard label="Total liabilities" value={totalLiabilities()} />
        <StatCard label="Net worth" value={totalAssets() - totalLiabilities()} />
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
                <Card key={a.id} className="p-5 gap-3">
                  <div>
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.institution}</div>
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
    </AppShell>
  );
}
