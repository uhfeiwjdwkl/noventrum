import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { EmptyState } from "@/components/finance/EmptyState";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/lib/finance/store";
import { fmtCurrency } from "@/lib/finance/data";
import { PiggyBank, Trash2 } from "lucide-react";
import { AddBudgetDialog } from "@/components/finance/AddDialogs";
import { useState } from "react";

export const Route = createFileRoute("/budget")({
  head: () => ({ meta: [{ title: "Budget — Noventrum" }] }),
  component: BudgetPage,
});

function BudgetPage() {
  const budgets = useFinance((s) => s.budgets);
  const deleteBudget = useFinance((s) => s.deleteBudget);
  const [addOpen, setAddOpen] = useState(false);

  const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const remaining = totalLimit - totalSpent;
  const pct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

  return (
    <AppShell
      title="Budget"
      subtitle="Monthly spending limits by category."
      actions={<AddBudgetDialog open={addOpen} onOpenChange={setAddOpen} trigger={<Button size="sm">Add budget</Button>} />}
    >
      {budgets.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-6 w-6" />}
          title="No budgets yet"
          description="Set monthly limits per category to stay on track."
          action={{ label: "Add budget", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <>
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
            <Progress value={Math.min(100, pct)} className="h-3" />
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgets.map((b) => {
              const p = b.limit > 0 ? (b.spent / b.limit) * 100 : 0;
              const over = p > 100;
              return (
                <Card key={b.id} className="p-5 gap-3 group relative">
                  <button
                    aria-label="Delete budget"
                    onClick={() => deleteBudget(b.id)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="flex items-center justify-between pr-6">
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
        </>
      )}
    </AppShell>
  );
}
