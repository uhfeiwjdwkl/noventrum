import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { budgets, fmtCurrency } from "@/lib/finance/data";

export const Route = createFileRoute("/budget")({
  head: () => ({ meta: [{ title: "Budget — FinFlow" }] }),
  component: BudgetPage,
});

function BudgetPage() {
  const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const remaining = totalLimit - totalSpent;
  const pct = (totalSpent / totalLimit) * 100;

  return (
    <AppShell title="Budget" subtitle="Monthly spending limits by category.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total budget" value={totalLimit} />
        <StatCard label="Spent" value={totalSpent} />
        <StatCard label="Remaining" value={remaining} />
        <StatCard label="Used" value={pct} currency={false} suffix="%" />
      </div>

      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Overall budget</div>
          <div className="text-sm num text-muted-foreground">{fmtCurrency(totalSpent)} / {fmtCurrency(totalLimit)}</div>
        </div>
        <Progress value={pct} className="h-3" />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets.map((b) => {
          const p = (b.spent / b.limit) * 100;
          const over = p > 100;
          return (
            <Card key={b.id} className="p-5 gap-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{b.category}</div>
                {over ? <Badge variant="destructive">Over</Badge> : p > 80 ? <Badge className="bg-warning text-warning-foreground">Close</Badge> : <Badge variant="secondary">On track</Badge>}
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-xl font-semibold num">{fmtCurrency(b.spent)}</div>
                <div className="text-sm text-muted-foreground num">of {fmtCurrency(b.limit)}</div>
              </div>
              <Progress value={Math.min(100, p)} className={over ? "[&>div]:bg-destructive" : ""} />
              <div className="text-xs text-muted-foreground num">{over ? `Over by ${fmtCurrency(b.spent - b.limit)}` : `${fmtCurrency(b.limit - b.spent)} remaining`}</div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
