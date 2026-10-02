import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Scatter,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { fmtCurrency } from "@/lib/finance/data";
import type { Dividend, Trade } from "@/lib/finance/data";
import { getHistory, type HistoryPoint } from "@/lib/prices.functions";

/** Selectable look-back windows mapped to Yahoo range/interval pairs. */
export const RANGES = [
  { key: "1M", range: "1mo", interval: "1d" },
  { key: "3M", range: "3mo", interval: "1d" },
  { key: "6M", range: "6mo", interval: "1d" },
  { key: "1Y", range: "1y", interval: "1d" },
  { key: "5Y", range: "5y", interval: "1wk" },
  { key: "MAX", range: "max", interval: "1mo" },
  { key: "Since first", range: "", interval: "" },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

function rangeSince(from: string) {
  const days = Math.ceil((Date.now() - new Date(from).getTime()) / 86_400_000) + 7;
  if (days <= 31) return { range: "1mo", interval: "1d" };
  if (days <= 92) return { range: "3mo", interval: "1d" };
  if (days <= 366) return { range: "1y", interval: "1d" };
  if (days <= 1826) return { range: "5y", interval: "1wk" };
  return { range: "max", interval: "1mo" };
}

/**
 * What the position is worth to you at each date: shares held x close
 * + cash returned (sales, dividends net of tax) - cash invested (buys incl. fees).
 * Can go negative.
 */
function positionWorth(points: HistoryPoint[], trades: Trade[], dividends: Dividend[]): HistoryPoint[] {
  const tr = [...trades].sort((a, b) => (a.date < b.date ? -1 : 1));
  const dv = [...dividends].sort((a, b) => (a.date < b.date ? -1 : 1));
  let i = 0, j = 0, shares = 0, cash = 0;
  return points.map((p) => {
    while (i < tr.length && tr[i].date <= p.date) {
      const t = tr[i++];
      const gross = t.shares * t.price;
      const costs = (t.fees || 0) + (t.tax || 0);
      if (t.side === "buy") { shares += t.shares; cash -= gross + costs; }
      else { shares -= t.shares; cash += gross - costs; }
    }
    while (j < dv.length && dv[j].date <= p.date) { const d = dv[j++]; cash += d.amount - (d.tax ?? 0); }
    return { ...p, close: Math.round((Math.max(0, shares) * p.close + cash) * 100) / 100 };
  });
}

interface Point extends HistoryPoint {
  buy?: number;
  sell?: number;
  marks?: Trade[];
}

/** Attach each trade to the nearest chart point so it renders as a dot. */
function withTradeMarkers(points: HistoryPoint[], trades: Trade[]): Point[] {
  const out: Point[] = points.map((p) => ({ ...p }));
  if (out.length === 0) return out;
  for (const t of trades) {
    let idx = out.findIndex((p) => p.date >= t.date);
    if (idx === -1) idx = out.length - 1;
    if (t.date < out[0].date) continue;
    const p = out[idx];
    p.marks = [...(p.marks ?? []), t];
    if (t.side === "buy") p.buy = p.close;
    else p.sell = p.close;
  }
  return out;
}

export function PriceChart({
  symbol,
  currency,
  trades = [],
  dividends = [],
  height = 320,
  defaultRange = "1Y",
  className,
}: {
  symbol: string;
  currency?: string;
  trades?: Trade[];
  dividends?: Dividend[];
  height?: number;
  defaultRange?: RangeKey;
  className?: string;
}) {
  const [rangeKey, setRangeKey] = useState<RangeKey>(defaultRange);
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [cur, setCur] = useState(currency ?? "USD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [mine, setMine] = useState(false);
  const firstActivity = useMemo(() => {
    const ds = [...trades.map((t) => t.date), ...dividends.map((d) => d.date)].sort();
    return ds[0];
  }, [trades, dividends]);
  const ranges = RANGES.filter((r) => r.key !== "Since first" || firstActivity);

  useEffect(() => {
    const base = RANGES.find((r) => r.key === rangeKey)!;
    const cfg = base.key === "Since first" ? (firstActivity ? rangeSince(firstActivity) : RANGES[3]) : base;
    let cancelled = false;
    setLoading(true);
    setError(false);
    getHistory({ data: { symbol, range: cfg.range, interval: cfg.interval } })
      .then((r) => {
        if (cancelled) return;
        setPoints(base.key === "Since first" && firstActivity ? r.points.filter((p) => p.date >= firstActivity) : r.points);
        if (r.currency) setCur(r.currency);
        setError(r.points.length === 0);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [symbol, rangeKey, firstActivity]);

  const data = useMemo(
    () => withTradeMarkers(mine ? positionWorth(points, trades, dividends) : points, trades),
    [points, trades, dividends, mine],
  );
  const comparison = useMemo(() => {
    if (selection.length !== 2) return null;
    const a = data.find((p) => p.date === selection[0]);
    const b = data.find((p) => p.date === selection[1]);
    if (!a || !b) return null;
    const first = a.date < b.date ? a : b;
    const last = a.date < b.date ? b : a;
    const value = last.close - first.close;
    return { first, last, value, pct: first.close ? (value / Math.abs(first.close)) * 100 : 0 };
  }, [data, selection]);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-sm text-muted-foreground">
          {mine ? `What ${symbol} is worth to you` : `${symbol} price history`}
          {trades.length > 0 && <span className="ml-2 text-xs">• dots mark your buys and sells</span>}
          {mine && <div className="text-xs">Holdings value + sales and dividends received − money put in</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {trades.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <Switch checked={mine} onCheckedChange={(v) => { setMine(v); setSelection([]); }} aria-label="Show my position value" />
            My position
          </label>
        )}
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {ranges.map((r) => (
            <Button
              key={r.key}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRangeKey(r.key)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors",
                r.key === rangeKey
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {r.key}
            </Button>
          ))}
        </div>
        </div>
      </div>
      {comparison && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <span>{comparison.first.date} → {comparison.last.date}</span>
          <span className={comparison.value >= 0 ? "text-success" : "text-destructive"}>
            {fmtCurrency(comparison.value, { currency: cur })} ({comparison.pct >= 0 ? "+" : ""}{comparison.pct.toFixed(2)}%)
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelection([])}>Clear</Button>
        </div>
      )}

      <div style={{ height }} className="relative">
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-background/60 z-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && error ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">
            No price history available for {symbol}.
          </div>
        ) : (
          <ResponsiveContainer>
            <ComposedChart
              data={data}
              onClick={(state) => {
                const date = typeof state?.activeLabel === "string" ? state.activeLabel : undefined;
                if (!date) return;
                setSelection((current) => current.length === 1 ? [current[0], date] : [date]);
              }}
              className="cursor-crosshair"
            >
              <defs>
                <linearGradient id={`pc-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" minTickGap={32} />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="var(--muted-foreground)"
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => fmtCurrency(v, { currency: cur, compact: true })}
              />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as Point;
                  return (
                    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                      <div className="text-muted-foreground">{label}</div>
                      <div className="font-semibold num">{fmtCurrency(p.close, { currency: cur })}</div>
                      {p.marks?.map((t) => (
                        <div
                          key={t.id}
                          className={t.side === "buy" ? "text-success mt-1" : "text-destructive mt-1"}
                        >
                          {t.side.toUpperCase()} {t.shares} @ {fmtCurrency(t.price, { currency: t.currency ?? cur })}
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              {mine && <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}
              <Area
                type="monotone"
                dataKey="close"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill={`url(#pc-${symbol})`}
              />
              {selection.length === 2 && (
                <ReferenceArea x1={selection[0]} x2={selection[1]} fill="var(--chart-2)" fillOpacity={0.12} />
              )}
              <Scatter dataKey="buy" fill="var(--chart-1)" shape="circle" legendType="none" />
              <Scatter dataKey="sell" fill="var(--chart-5)" shape="circle" legendType="none" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
