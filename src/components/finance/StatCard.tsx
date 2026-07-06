import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtCurrency, fmtPct } from "@/lib/finance/data";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  change,
  icon,
  hint,
  currency = true,
  suffix,
}: {
  label: string;
  value: number;
  change?: number;
  icon?: ReactNode;
  hint?: string;
  currency?: boolean;
  suffix?: string;
}) {
  const up = (change ?? 0) >= 0;
  const display = currency
    ? fmtCurrency(value, { compact: Math.abs(value) >= 100000 })
    : suffix === "%"
      ? `${value.toFixed(1)}%`
      : value.toLocaleString();
  return (
    <Card className="p-5 gap-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground font-medium">{label}</div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="text-2xl sm:text-3xl font-semibold tracking-tight num">{display}</div>
      {change !== undefined && (
        <div className={cn("flex items-center gap-1 text-xs font-medium", up ? "text-success" : "text-destructive")}>
          {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          <span>{fmtPct(change)}</span>
          {hint && <span className="text-muted-foreground font-normal ml-1">{hint}</span>}
        </div>
      )}
    </Card>
  );
}
