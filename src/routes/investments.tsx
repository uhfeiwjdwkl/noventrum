import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { EmptyState } from "@/components/finance/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinance } from "@/lib/finance/store";
import { portfolioCost, portfolioValue, assetAllocation, realizedPL, fmtCurrency, fmtPct } from "@/lib/finance/data";
import type { Trade } from "@/lib/finance/data";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { LineChart as LineIcon, Trash2, RefreshCw, Pencil } from "lucide-react";
import { BuySellDialog } from "@/components/finance/ExtraDialogs";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/investments")({
  head: () => ({ meta: [{ title: "Investments — Noventrum" }, { name: "description", content: "Track holdings, performance, allocation and trades." }] }),
  component: InvestmentsPage,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

function InvestmentsPage() {
  const holdings = useFinance((s) => s.holdings);
  const trades = useFinance((s) => s.trades);
  const accounts = useFinance((s) => s.accounts);
  const deleteHolding = useFinance((s) => s.deleteHolding);
  const deleteTrade = useFinance((s) => s.deleteTrade);
  const refreshPrices = useFinance((s) => s.refreshPrices);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [editing, setEditing] = useState<Trade | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function doRefresh() {
    setRefreshing(true);
    const r = await refreshPrices();
    setRefreshing(false);
    if (r.updated) toast.success(`Updated ${r.updated} quote${r.updated === 1 ? "" : "s"}`);
    else toast.error("Live quotes failed");
  }

  const pv = portfolioValue(holdings);
  const pc = portfolioCost(holdings);
  const pl = pv - pc;
  const plPct = pc > 0 ? (pl / pc) * 100 : 0;
  const realized = realizedPL(holdings);
  const alloc = assetAllocation(holdings);
  const sortedTrades = [...trades].sort((a, b) => (a.date < b.date ? 1 : -1));


  return (
    <AppShell
      title="Investments"
      subtitle="Your portfolio at a glance."
      actions={
        <>
          <Button size="sm" variant="outline" onClick={doRefresh} disabled={refreshing || holdings.length === 0} className="gap-1.5">
            <RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} />
            {refreshing ? "Syncing" : "Refresh prices"}
          </Button>
          <BuySellDialog open={tradeOpen} onOpenChange={setTradeOpen} trigger={<Button size="sm" variant="secondary">Buy / Sell</Button>} />
        </>
      }
    >
      {holdings.length === 0 && trades.length === 0 ? (
        <EmptyState
          icon={<LineIcon className="h-6 w-6" />}
          title="No trades yet"
          description="Log a buy — search any stock, ETF, crypto or commodity and your holdings build themselves from the ledger."
          action={{ label: "Log a trade", onClick: () => setTradeOpen(true) }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <StatCard label="Portfolio value" value={pv} change={plPct} hint="all time" />
            <StatCard label="Cost basis" value={pc} />
            <StatCard label="Unrealized P/L" value={pl} />
            <StatCard label="Realized P/L" value={realized} />
            <StatCard label="Holdings" value={holdings.length} currency={false} />
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Card className="p-5 lg:col-span-2">
              <div className="mb-4 font-semibold">Holdings</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead><TableHead>Shares</TableHead><TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Value</TableHead><TableHead className="text-right">P/L</TableHead><TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h) => {
                    const val = h.shares * h.price;
                    const gain = val - h.shares * h.avgCost;
                    const gainPct = h.avgCost > 0 ? (gain / (h.shares * h.avgCost)) * 100 : 0;
                    return (
                      <TableRow key={h.id} className="group">
                        <TableCell>
                          <Link to="/investments/$symbol" params={{ symbol: h.symbol }} className="font-semibold hover:text-primary">{h.symbol}</Link>
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">{h.name}</div>
                        </TableCell>
                        <TableCell className="num">{h.shares}</TableCell>
                        <TableCell className="text-right num">{fmtCurrency(h.price)}</TableCell>
                        <TableCell className="text-right num font-medium">{fmtCurrency(val)}</TableCell>
                        <TableCell className={"text-right num " + (gain >= 0 ? "text-success" : "text-destructive")}>
                          {fmtCurrency(gain)} <span className="text-xs">({fmtPct(gainPct)})</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <button onClick={() => deleteHolding(h.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            <Card className="p-5">
              <div className="mb-4 font-semibold">Asset allocation</div>
              <div className="h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={alloc} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {alloc.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmtCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {alloc.map((a, i) => (
                  <div key={a.name} className="flex items-center justify-between text-xs capitalize">
                    <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{a.name}</div>
                    <span className="num text-muted-foreground">{fmtCurrency(a.value)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <div className="mb-1 font-semibold">Trade ledger</div>
            <p className="text-xs text-muted-foreground mb-4">
              Every position is calculated from these entries — edit or backdate any of them and holdings, cost basis and past net worth re-sync.
            </p>
            {sortedTrades.length === 0 ? (
              <div className="text-sm text-muted-foreground">No trades logged yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Asset</TableHead><TableHead>Side</TableHead>
                    <TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Fees / Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Account</TableHead><TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTrades.map((t) => {
                    const extra = (t.fees || 0) + (t.tax ?? 0);
                    const total = t.side === "buy" ? t.shares * t.price + extra : t.shares * t.price - extra;
                    return (
                      <TableRow key={t.id} className="group">
                        <TableCell className="num text-muted-foreground">{t.date}</TableCell>
                        <TableCell className="font-medium">{t.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={t.side === "buy" ? "secondary" : "outline"} className="capitalize">{t.side}</Badge>
                        </TableCell>
                        <TableCell className="text-right num">{t.shares}</TableCell>
                        <TableCell className="text-right num">{fmtCurrency(t.price, { currency: t.currency })}</TableCell>
                        <TableCell className="text-right num text-muted-foreground">{extra ? fmtCurrency(extra, { currency: t.currency }) : "—"}</TableCell>
                        <TableCell className="text-right num font-medium">{fmtCurrency(total, { currency: t.currency })}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{accounts.find((a) => a.id === t.accountId)?.name ?? "—"}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <button onClick={() => setEditing(t)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary mr-2" aria-label="Edit trade"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => { deleteTrade(t.id); toast.success("Trade removed"); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" aria-label="Delete trade"><Trash2 className="h-4 w-4" /></button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}
      {editing && (
        <BuySellDialog
          key={editing.id}
          editTrade={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}

    </AppShell>
  );
}
