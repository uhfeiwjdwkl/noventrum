import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { goals, fmtCurrency } from "@/lib/finance/data";
import { Target } from "lucide-react";

export const Route = createFileRoute("/goals")({
  head: () => ({ meta: [{ title: "Goals — FinFlow" }] }),
  component: GoalsPage,
});

function monthsUntil(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
}

function GoalsPage() {
  return (
    <AppShell title="Goals" subtitle="Save toward what matters most.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((g) => {
          const pct = (g.current / g.target) * 100;
          const remaining = g.target - g.current;
          const monthsToDeadline = Math.max(1, monthsUntil(g.deadline));
          const monthsAtRate = Math.ceil(remaining / g.monthlyContribution);
          const onTrack = monthsAtRate <= monthsToDeadline;
          const projected = new Date();
          projected.setMonth(projected.getMonth() + monthsAtRate);

          return (
            <Card key={g.id} className="p-6 gap-4">
              <div className="flex items-start justify-between">
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
                <Progress value={pct} className="h-2.5" />
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
                  <div className="font-medium num">{projected.toISOString().slice(0, 7)}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
