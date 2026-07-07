import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/finance/EmptyState";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/lib/finance/store";
import { fmtCurrency } from "@/lib/finance/data";
import { Target, Trash2 } from "lucide-react";
import { AddGoalDialog } from "@/components/finance/AddDialogs";
import { useState } from "react";

export const Route = createFileRoute("/goals")({
  head: () => ({ meta: [{ title: "Goals — Noventrum" }] }),
  component: GoalsPage,
});

function monthsUntil(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
}

function GoalsPage() {
  const goals = useFinance((s) => s.goals);
  const deleteGoal = useFinance((s) => s.deleteGoal);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <AppShell
      title="Goals"
      subtitle="Save toward what matters most."
      actions={<AddGoalDialog open={addOpen} onOpenChange={setAddOpen} trigger={<Button size="sm">Add goal</Button>} />}
    >
      {goals.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="No goals yet"
          description="Emergency fund, vacation, down payment — track progress toward any target."
          action={{ label: "Add goal", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
            const remaining = g.target - g.current;
            const monthsToDeadline = Math.max(1, monthsUntil(g.deadline));
            const monthsAtRate = g.monthlyContribution > 0 ? Math.ceil(remaining / g.monthlyContribution) : Infinity;
            const onTrack = monthsAtRate <= monthsToDeadline;
            const projected = new Date();
            if (isFinite(monthsAtRate)) projected.setMonth(projected.getMonth() + monthsAtRate);

            return (
              <Card key={g.id} className="p-6 gap-4 group relative">
                <button
                  aria-label="Delete goal"
                  onClick={() => deleteGoal(g.id)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex items-start justify-between pr-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-accent text-accent-foreground grid place-items-center"><Target className="h-5 w-5" /></div>
                    <div>
                      <div className="font-semibold">{g.name}</div>
                      <div className="text-xs text-muted-foreground">Target: {g.deadline}</div>
                    </div>
                  </div>
                  <Badge variant={onTrack ? "default" : "destructive"} className={onTrack ? "bg-success text-success-foreground" : ""}>
                    {onTrack ? "On track" : "Behind"}
                  </Badge>
                </div>
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-2xl font-semibold num">{fmtCurrency(g.current)}</div>
                    <div className="text-sm text-muted-foreground num">of {fmtCurrency(g.target)}</div>
                  </div>
                  <Progress value={Math.min(100, pct)} className="h-2.5" />
                  <div className="text-xs text-muted-foreground mt-1 num">{pct.toFixed(1)}% complete</div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm pt-2 border-t border-border">
                  <div>
                    <div className="text-xs text-muted-foreground">Monthly</div>
                    <div className="font-medium num">{fmtCurrency(g.monthlyContribution)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Remaining</div>
                    <div className="font-medium num">{fmtCurrency(remaining)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Projected</div>
                    <div className="font-medium num">{isFinite(monthsAtRate) ? projected.toISOString().slice(0, 7) : "—"}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
