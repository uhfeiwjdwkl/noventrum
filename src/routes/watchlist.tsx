import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/finance/EmptyState";
import { SymbolSearch } from "@/components/finance/SymbolSearch";
import { PriceChart } from "@/components/finance/PriceChart";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useFinance } from "@/lib/finance/store";
import { fmtCurrency, fmtPct } from "@/lib/finance/data";
import type { AssetClass } from "@/lib/finance/data";
import type { SymbolMatch } from "@/lib/prices.functions";
import { CandlestickChart, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist — Noventrum" },
      { name: "description", content: "Track live prices and historical charts for the tickers you follow." },
      { property: "og:title", content: "Watchlist — Noventrum" },
      { property: "og:description", content: "Live quotes and price history for your tracked tickers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WatchlistPage,
});

/** Yahoo quote types mapped onto our internal asset classes. */
function classOf(type: string): AssetClass {
  const t = type.toLowerCase();
  if (t.includes("etf")) return "etf";
  if (t.includes("crypto")) return "crypto";
  if (t.includes("currency")) return "forex";
  if (t.includes("future")) return "commodity";
  if (t.includes("equity")) return "stock";
  return "other";
}

function AddTickerDialog() {
  const addWatch = useFinance((s) => s.addWatch);
  const refreshWatchlist = useFinance((s) => s.refreshWatchlist);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [bulk, setBulk] = useState("");

  function pick(m: SymbolMatch) {
    addWatch({ symbol: m.symbol, name: m.name, assetClass: classOf(m.type) });
    toast.success(`${m.symbol} added to your watchlist`);
    setQ("");
    setOpen(false);
    void refreshWatchlist();
  }

  function addBulk() {
    const symbols = bulk.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    symbols.forEach((symbol) => addWatch({ symbol, name: symbol, assetClass: "other" }));
    if (symbols.length) {
      toast.success(`Added ${symbols.length} ticker${symbols.length === 1 ? "" : "s"}`);
      setBulk("");
      setOpen(false);
      void refreshWatchlist();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Add ticker</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a ticker to your watchlist</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Search any stock, ETF, crypto, commodity or currency pair. Watching a ticker never touches your ledger.
        </p>
        <SymbolSearch value={q} onChange={setQ} onSelect={pick} autoFocus />
        <div className="border-t pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Or paste tickers in bulk</p>
          <Textarea value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="AAPL, MSFT, VAS.AX, BTC-USD" />
          <Button type="button" variant="outline" className="mt-2" onClick={addBulk} disabled={!bulk.trim()}>Add all</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WatchlistPage() {
  const watchlist = useFinance((s) => s.watchlist);
  const removeWatch = useFinance((s) => s.removeWatch);
  const refreshWatchlist = useFinance((s) => s.refreshWatchlist);
  const trades = useFinance((s) => s.trades);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    void refreshWatchlist();
  }, [refreshWatchlist]);

  const active = useMemo(
    () => watchlist.find((w) => w.symbol === selected) ?? watchlist[0],
    [watchlist, selected],
  );
  const activeTrades = useMemo(
    () => (active ? trades.filter((t) => t.symbol === active.symbol) : []),
    [trades, active],
  );

  async function doRefresh() {
    setRefreshing(true);
    await refreshWatchlist();
    setRefreshing(false);
    toast.success("Quotes updated");
  }

  return (
    <AppShell
      title="Watchlist"
      subtitle="Live quotes and price history for the tickers you follow."
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={doRefresh}
            disabled={refreshing || watchlist.length === 0}
            className="gap-1.5"
          >
            <RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} />
            {refreshing ? "Syncing" : "Refresh"}
          </Button>
          <AddTickerDialog />
        </>
      }
    >
      {watchlist.length === 0 ? (
        <div className="grid place-items-center gap-4">
          <EmptyState
            icon={<CandlestickChart className="h-6 w-6" />}
            title="Your watchlist is empty"
            description="Add a ticker to follow its live price and full history — no trade required."
          />
          <AddTickerDialog />
        </div>

      ) : (
        <>
          {active && (
            <Card className="p-5 mb-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <div>
                  <div className="font-semibold">{active.symbol}</div>
                  <div className="text-xs text-muted-foreground">{active.name}</div>
                </div>
                {active.price !== undefined && (
                  <div className="text-right">
                    <div className="text-xl font-semibold num">
                      {fmtCurrency(active.price, { currency: active.currency })}
                    </div>
                    <div className={"text-xs num " + ((active.dayChangePct ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                      {fmtPct(active.dayChangePct ?? 0)}
                    </div>
                  </div>
                )}
              </div>
              <PriceChart symbol={active.symbol} currency={active.currency} trades={activeTrades} height={320} />
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {watchlist.map((w) => (
              <Card
                key={w.symbol}
                onClick={() => setSelected(w.symbol)}
                className={
                  "p-5 gap-3 cursor-pointer transition-colors group " +
                  (active?.symbol === w.symbol ? "border-primary" : "hover:border-primary/50")
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{w.symbol}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[150px]">{w.name}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="capitalize text-xs">{w.assetClass}</Badge>
                    <button
                      aria-label={`Remove ${w.symbol}`}
                      onClick={(e) => { e.stopPropagation(); removeWatch(w.symbol); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="text-lg font-semibold num">
                    {w.price !== undefined ? fmtCurrency(w.price, { currency: w.currency }) : "—"}
                  </div>
                  <div className={"text-sm font-medium num " + ((w.dayChangePct ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                    {w.dayChangePct !== undefined ? fmtPct(w.dayChangePct) : ""}
                  </div>
                </div>
                <Link
                  to="/investments/$symbol"
                  params={{ symbol: w.symbol }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-primary hover:underline"
                >
                  Open full view
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
