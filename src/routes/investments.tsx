import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { EmptyState } from "@/components/finance/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinance } from "@/lib/finance/store";
import { portfolioCost, portfolioValue, assetAllocation, fmtCurrency, fmtPct } from "@/lib/finance/data";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { LineChart as LineIcon, Trash2, RefreshCw } from "lucide-react";
import { AddHoldingDialog } from "@/components/finance/AddDialogs";
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
  const deleteHolding = useFinance((s) => s.deleteHolding);
  const refreshPrices = useFinance((s) => s.refreshPrices);
  const [addOpen, setAddOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
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
  const alloc = assetAllocation(holdings);

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
          <AddHoldingDialog open={addOpen} onOpenChange={setAddOpen} trigger={<Button size="sm">Add holding</Button>} />
        </>
      }
    >
      {holdings.length === 0 ? (
        <EmptyState
          icon={<LineIcon className="h-6 w-6" />}
          title="No holdings yet"
          description="Add stocks, ETFs, crypto or other positions to track your portfolio."
          action={{ label: "Add holding", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Portfolio value" value={pv} change={plPct} hint="all time" />
            <StatCard label="Cost basis" value={pc} />
            <StatCard label="Unrealized P/L" value={pl} />
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
        </>
      )}
    </AppShell>
  );
}
