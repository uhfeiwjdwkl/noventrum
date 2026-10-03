import { useEffect } from "react";
import { create } from "zustand";
import { Flag, X } from "lucide-react";
import { useFinance } from "@/lib/finance/store";
import { getPriceAt } from "@/lib/prices.functions";
import type { Trade } from "@/lib/finance/data";

const EMPTY: string[] = [];

/** A trade whose entered price is >10% away from that day's market close. */
export interface TradeMismatch {
  tradeId: string;
  symbol: string;
  date: string;
  tradePrice: number;
  marketPrice: number;
  diffPct: number;
}

const THRESHOLD = 0.1;
const tradeKey = (t: Trade) => `${t.id}|${t.symbol.toUpperCase()}|${t.date}|${t.price}`;

/** In-memory only: market closes are re-fetchable so nothing is persisted. */
const useFlagCache = create<{ results: Record<string, TradeMismatch | null>; pending: Set<string> }>(() => ({
  results: {},
  pending: new Set(),
}));

/** Checks every trade against that day's historical close. Mount once. */
export function useTickerFlagScanner() {
  const trades = useFinance((s) => s.trades);
  const enabled = useFinance((s) => s.settings.autoFlag ?? true);
  useEffect(() => {
    if (!enabled) return;
    const todo = trades.filter((t) => {
      if (t.assetClass === "forex" || t.exchange || !(t.price > 0)) return false;
      const k = tradeKey(t);
      const st = useFlagCache.getState();
      return !(k in st.results) && !st.pending.has(k);
    });
    if (!todo.length) return;
    let cancelled = false;
    todo.forEach((t) => useFlagCache.getState().pending.add(tradeKey(t)));
    (async () => {
      const queue = [...todo];
      const worker = async () => {
        while (queue.length && !cancelled) {
          const t = queue.shift()!;
          const k = tradeKey(t);
          let res: TradeMismatch | null = null;
          try {
            const p = await getPriceAt({ data: { symbol: t.symbol, date: t.date } });
            const sameCur = !t.currency || !p?.currency || p.currency.toUpperCase() === t.currency.toUpperCase();
            if (p && p.price > 0 && sameCur) {
              const diff = (t.price - p.price) / p.price;
              if (Math.abs(diff) > THRESHOLD)
                res = { tradeId: t.id, symbol: t.symbol.toUpperCase(), date: t.date, tradePrice: t.price, marketPrice: p.price, diffPct: diff * 100 };
            }
          } catch {
            res = null;
          }
          useFlagCache.getState().pending.delete(k);
          useFlagCache.setState((s) => ({ results: { ...s.results, [k]: res } }));
        }
      };
      await Promise.all([worker(), worker(), worker()]);
    })();
    return () => {
      cancelled = true;
      todo.forEach((t) => useFlagCache.getState().pending.delete(tradeKey(t)));
    };
  }, [trades, enabled]);
}

/** Active mismatches, respecting the global switch and per-asset dismissals. */
export function useTickerMismatches(symbol?: string): TradeMismatch[] {
  const results = useFlagCache((s) => s.results);
  const trades = useFinance((s) => s.trades);
  const enabled = useFinance((s) => s.settings.autoFlag ?? true);
  const ignore = useFinance((s) => s.settings.flagIgnore) ?? EMPTY;
  if (!enabled) return [];
  const sym = symbol?.toUpperCase();
  const out: TradeMismatch[] = [];
  for (const t of trades) {
    const r = results[tradeKey(t)];
    if (!r || ignore.includes(r.symbol)) continue;
    if (sym && r.symbol !== sym) continue;
    out.push(r);
  }
  return out;
}

/** Small flag shown beside an asset wherever it appears. */
export function TickerFlag({ symbol, dismissible = false }: { symbol: string; dismissible?: boolean }) {
  const list = useTickerMismatches(symbol);
  const ignore = useFinance((s) => s.settings.flagIgnore) ?? EMPTY;
  const updateSettings = useFinance((s) => s.updateSettings);
  if (!list.length) return null;
  const worst = list.reduce((a, b) => (Math.abs(b.diffPct) > Math.abs(a.diffPct) ? b : a));
  const title = `Possible wrong ticker: ${list.length} trade${list.length === 1 ? "" : "s"} priced over 10% away from the market close (e.g. ${worst.date}: entered ${worst.tradePrice.toFixed(2)}, market ${worst.marketPrice.toFixed(2)}).`;
  return (
    <span className="inline-flex items-center gap-0.5 text-warning align-middle" title={title} aria-label={title}>
      <Flag className="h-3.5 w-3.5 fill-current" />
      {dismissible && (
        <button
          type="button"
          aria-label={`Clear flag for ${symbol}`}
          className="text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); updateSettings({ flagIgnore: [...ignore, symbol.toUpperCase()] }); }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
