import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "@/lib/finance/data";
import type { Trade } from "@/lib/finance/data";
import { getHistory, type HistoryPoint } from "@/lib/prices.functions";

/** Selectable look-back windows mapped to Yahoo range/interval pairs. */
export const RANGES = [
  { key: "1M", range: "1mo", interval: "1d" },
  { key: "3M", range: "3mo", interval: "1d" },
  { key: "6M", range: "6mo", interval: "1d" },
  { key: "1Y", range: "1y", interval: "1d" },
  { key: "5Y", range: "5y", interval: "1wk" },
  { key: "MAX", range: "max", interval: "1mo" },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

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
  height = 320,
  defaultRange = "1Y",
  className,
}: {
  symbol: string;
  currency?: string;
  trades?: Trade[];
  height?: number;
  defaultRange?: RangeKey;
  className?: string;
}) {
  const [rangeKey, setRangeKey] = useState<RangeKey>(defaultRange);
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [cur, setCur] = useState(currency ?? "USD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const cfg = RANGES.find((r) => r.key === rangeKey)!;
    let cancelled = false;
    setLoading(true);
    setError(false);
    getHistory({ data: { symbol, range: cfg.range, interval: cfg.interval } })
      .then((r) => {
        if (cancelled) return;
        setPoints(r.points);
        if (r.currency) setCur(r.currency);
        setError(r.points.length === 0);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [symbol, rangeKey]);

  const data = useMemo(() => withTradeMarkers(points, trades), [points, trades]);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-sm text-muted-foreground">
          {symbol} price history
          {trades.length > 0 && <span className="ml-2 text-xs">• dots mark your buys and sells</span>}
        </div>
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRangeKey(r.key)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors",
                r.key === rangeKey
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>

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
            <ComposedChart data={data}>
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
              <Area
                type="monotone"
                dataKey="close"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill={`url(#pc-${symbol})`}
              />
              <Scatter dataKey="buy" fill="var(--chart-1)" shape="circle" legendType="none" />
              <Scatter dataKey="sell" fill="var(--chart-5)" shape="circle" legendType="none" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
