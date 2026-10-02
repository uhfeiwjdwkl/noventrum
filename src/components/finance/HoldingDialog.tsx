import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";
import { PriceChart } from "@/components/finance/PriceChart";
import { AddDividendDialog, BuySellDialog } from "@/components/finance/ExtraDialogs";
import { BulkControls, SelectBox, useSelection, type LedgerRef } from "@/components/finance/BulkEdit";
import { TickerFlag } from "@/components/finance/TickerFlag";
import { useFinance } from "@/lib/finance/store";
import { fmtCurrency, fmtPct, holdingPL, toBase, type Dividend, type Trade } from "@/lib/finance/data";

type Row =
  | { kind: "trade"; date: string; t: Trade }
  | { kind: "div"; date: string; d: Dividend };

export function HoldingDialog({ symbol, open, onOpenChange }: { symbol: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const holdings = useFinance((s) => s.holdings);
  const trades = useFinance((s) => s.trades);
  const dividends = useFinance((s) => s.dividends);
  const fxRates = useFinance((s) => s.fxRates);
  const base = useFinance((s) => s.settings.baseCurrency);
  const deleteTrade = useFinance((s) => s.deleteTrade);
  const deleteDividend = useFinance((s) => s.deleteDividend);
  const [tradeSide, setTradeSide] = useState<"buy" | "sell" | null>(null);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [editDiv, setEditDiv] = useState<Dividend | null>(null);
  const [query, setQuery] = useState("");
  const [side, setSide] = useState("all");
  const sel = useSelection();
  const holding = holdings.find((h) => h.symbol === symbol);
  const rows = useMemo<Row[]>(() => {
    const sym = symbol?.toUpperCase();
    const tr: Row[] = trades.filter((t) => t.symbol.toUpperCase() === sym).map((t) => ({ kind: "trade", date: t.date, t }));
    const dv: Row[] = dividends.filter((d) => d.symbol.toUpperCase() === sym).map((d) => ({ kind: "div", date: d.date, d }));
    return [...tr, ...dv]
      .filter((r) => side === "all" || (side === "div" ? r.kind === "div" : r.kind === "trade" && r.t.side === side))
      .filter((r) => !query || `${r.date} ${r.kind === "trade" ? r.t.notes ?? "" : "dividend"}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [trades, dividends, symbol, side, query]);
  if (!holding || !symbol) return null;
  const allTrades = trades.filter((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
  const value = toBase(holding.shares * holding.price, holding.currency, fxRates, base);
  const pl = holdingPL(holding, fxRates, base);
  const cost = holding.shares * (holding.avgCostBase || holding.avgCost);
  const divs = dividends.filter((d) => d.symbol.toUpperCase() === symbol.toUpperCase()).reduce((sum, d) => sum + toBase(d.amount - (d.tax ?? 0), d.currency, fxRates, base), 0);
  const refOf = (r: Row): LedgerRef => (r.kind === "trade" ? { type: "trade", id: r.t.id } : { type: "div", id: r.d.id });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{symbol} — {holding.name} <TickerFlag symbol={symbol} dismissible /></DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <span>Value <strong className="num">{fmtCurrency(value)}</strong></span>
              <span>Total P/L <strong className={pl.total >= 0 ? "num text-success" : "num text-destructive"}>{fmtCurrency(pl.total)}</strong></span>
              <span>Unrealised <strong className="num">{fmtCurrency(pl.unrealised)}{cost > 0 && ` (${fmtPct((pl.unrealised / cost) * 100)})`}</strong></span>
              <span>Realised <strong className="num">{fmtCurrency(pl.realised)}</strong></span>
              <span>Dividends <strong className="num">{fmtCurrency(divs)}</strong></span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setTradeSide("buy")}>Buy</Button>
              <Button size="sm" variant="outline" onClick={() => setTradeSide("sell")}>Sell</Button>
            </div>
          </div>
          <PriceChart symbol={symbol} currency={holding.currency} trades={allTrades} dividends={dividends.filter((d) => d.symbol.toUpperCase() === symbol.toUpperCase())} height={360} />
          <div className="flex flex-wrap gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes or date…" className="max-w-sm" />
            <Select value={side} onValueChange={setSide}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entries</SelectItem>
                <SelectItem value="buy">Buys</SelectItem>
                <SelectItem value="sell">Sells</SelectItem>
                <SelectItem value="div">Dividends</SelectItem>
              </SelectContent>
            </Select>
            <BulkControls sel={sel} all={rows.map(refOf)} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {sel.active && <TableHead className="w-8" />}
                <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Price / Amount</TableHead><TableHead className="text-right">Fees / Tax</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.kind}-${r.kind === "trade" ? r.t.id : r.d.id}`}>
                  {sel.active && <TableCell><SelectBox label="Select entry" checked={sel.has(refOf(r))} onChange={(v) => sel.toggle(refOf(r), v)} /></TableCell>}
                  <TableCell>{r.date}</TableCell>
                  {r.kind === "trade" ? (
                    <>
                      <TableCell><Badge variant={r.t.side === "buy" ? "secondary" : "outline"}>{r.t.side}</Badge></TableCell>
                      <TableCell className="text-right num">{r.t.shares}</TableCell>
                      <TableCell className="text-right num">{fmtCurrency(r.t.price, { currency: r.t.currency })}</TableCell>
                      <TableCell className="text-right num">{fmtCurrency((r.t.fees || 0) + (r.t.tax || 0), { currency: r.t.currency })}</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell><Badge>dividend</Badge></TableCell>
                      <TableCell className="text-right num">—</TableCell>
                      <TableCell className="text-right num text-success">{fmtCurrency(r.d.amount, { currency: r.d.currency })}</TableCell>
                      <TableCell className="text-right num">{fmtCurrency(r.d.tax ?? 0, { currency: r.d.currency })}</TableCell>
                    </>
                  )}
                  <TableCell className="text-right whitespace-nowrap">
                    <button aria-label="Edit" className="text-muted-foreground hover:text-foreground mr-2" onClick={() => (r.kind === "trade" ? setEditTrade(r.t) : setEditDiv(r.d))}><Pencil className="h-4 w-4" /></button>
                    <button aria-label="Delete" className="text-muted-foreground hover:text-destructive" onClick={() => (r.kind === "trade" ? deleteTrade(r.t.id) : deleteDividend(r.d.id))}><Trash2 className="h-4 w-4" /></button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {editTrade && <BuySellDialog key={editTrade.id} editTrade={editTrade} open onOpenChange={(o) => !o && setEditTrade(null)} />}
          {editDiv && <AddDividendDialog key={editDiv.id} editDividend={editDiv} open onOpenChange={(o) => !o && setEditDiv(null)} />}
        </DialogContent>
      </Dialog>
      {tradeSide && <BuySellDialog open onOpenChange={(next) => !next && setTradeSide(null)} defaultSide={tradeSide} defaultSymbol={symbol} defaultName={holding.name} defaultAssetClass={holding.assetClass} defaultCurrency={holding.currency} />}
    </>
  );
}
