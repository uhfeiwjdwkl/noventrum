import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriceChart } from "@/components/finance/PriceChart";
import { BuySellDialog } from "@/components/finance/ExtraDialogs";
import { useFinance } from "@/lib/finance/store";
import { fmtCurrency, fmtPct } from "@/lib/finance/data";

export function HoldingDialog({ symbol, open, onOpenChange }: { symbol: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const holdings = useFinance((s) => s.holdings);
  const trades = useFinance((s) => s.trades);
  const dividends = useFinance((s) => s.dividends);
  const [tradeSide, setTradeSide] = useState<"buy" | "sell" | null>(null);
  const [query, setQuery] = useState("");
  const [side, setSide] = useState("all");
  const holding = holdings.find((h) => h.symbol === symbol);
  const history = useMemo(() => trades
    .filter((t) => t.symbol === symbol)
    .filter((t) => side === "all" || t.side === side)
    .filter((t) => !query || `${t.date} ${t.notes ?? ""}`.toLowerCase().includes(query.toLowerCase())), [trades, symbol, side, query]);
  if (!holding || !symbol) return null;
  const allTrades = trades.filter((t) => t.symbol === symbol);
  const value = holding.shares * holding.price;
  const cost = holding.shares * holding.avgCost;
  const gain = value - cost;
  const divs = dividends.filter((d) => d.symbol === symbol).reduce((sum, d) => sum + d.amount, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{symbol} — {holding.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-4 text-sm">
              <span>Value <strong className="num">{fmtCurrency(value)}</strong></span>
              <span>P/L <strong className={gain >= 0 ? "num text-success" : "num text-destructive"}>{fmtCurrency(gain)} ({fmtPct(cost ? gain / cost * 100 : 0)})</strong></span>
              <span>Dividends <strong className="num">{fmtCurrency(divs)}</strong></span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setTradeSide("buy")}>Buy</Button>
              <Button size="sm" variant="outline" onClick={() => setTradeSide("sell")}>Sell</Button>
            </div>
          </div>
          <PriceChart symbol={symbol} currency={holding.currency} trades={allTrades} height={360} />
          <div className="flex flex-wrap gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search trade notes or date…" className="max-w-sm" />
            <Select value={side} onValueChange={setSide}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All trades</SelectItem><SelectItem value="buy">Buys</SelectItem><SelectItem value="sell">Sells</SelectItem></SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Side</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Fees / Tax</TableHead></TableRow></TableHeader>
            <TableBody>{history.map((t) => <TableRow key={t.id}><TableCell>{t.date}</TableCell><TableCell><Badge variant={t.side === "buy" ? "secondary" : "outline"}>{t.side}</Badge></TableCell><TableCell className="text-right num">{t.shares}</TableCell><TableCell className="text-right num">{fmtCurrency(t.price, { currency: t.currency })}</TableCell><TableCell className="text-right num">{fmtCurrency((t.fees || 0) + (t.tax || 0), { currency: t.currency })}</TableCell></TableRow>)}</TableBody>
          </Table>
        </DialogContent>
      </Dialog>
      {tradeSide && <BuySellDialog open onOpenChange={(next) => !next && setTradeSide(null)} defaultSide={tradeSide} defaultSymbol={symbol} defaultName={holding.name} defaultAssetClass={holding.assetClass} defaultCurrency={holding.currency} />}
    </>
  );
}