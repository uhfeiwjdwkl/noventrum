import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { holdings, portfolioCost, portfolioValue, trades, assetAllocation, fmtCurrency, fmtPct } from "@/lib/finance/data";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Line, LineChart } from "recharts";

export const Route = createFileRoute("/investments")({
  head: () => ({ meta: [{ title: "Investments — FinFlow" }, { name: "description", content: "Track holdings, performance, allocation and trades." }] }),
  component: InvestmentsPage,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

function InvestmentsPage() {
  const pv = portfolioValue();
  const pc = portfolioCost();
  const pl = pv - pc;
  const plPct = (pl / pc) * 100;
  const alloc = assetAllocation();
  const totalAlloc = alloc.reduce((s, a) => s + a.value, 0);

  return (
    <AppShell title="Investments" subtitle="Your portfolio at a glance.">
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
                <TableHead className="text-right">Value</TableHead><TableHead className="text-right">P/L</TableHead><TableHead className="text-right">Day</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((h) => {
                const val = h.shares * h.price;
                const pl = val - h.shares * h.avgCost;
                const plPct = (pl / (h.shares * h.avgCost)) * 100;
                return (
                  <TableRow key={h.id}>
                    <TableCell>
                      <Link to="/investments/$symbol" params={{ symbol: h.symbol }} className="font-semibold hover:text-primary">{h.symbol}</Link>
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]">{h.name}</div>
                    </TableCell>
                    <TableCell className="num">{h.shares}</TableCell>
                    <TableCell className="text-right num">{fmtCurrency(h.price)}</TableCell>
                    <TableCell className="text-right num font-medium">{fmtCurrency(val)}</TableCell>
                    <TableCell className={"text-right num " + (pl >= 0 ? "text-success" : "text-destructive")}>
                      {fmtCurrency(pl)} <span className="text-xs">({fmtPct(plPct)})</span>
                    </TableCell>
                    <TableCell className={"text-right num " + (h.dayChangePct >= 0 ? "text-success" : "text-destructive")}>{fmtPct(h.dayChangePct)}</TableCell>
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
              <div key={a.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 capitalize"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{a.name}</div>
                <span className="num text-muted-foreground">{((a.value / totalAlloc) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 font-semibold">Recent trades</div>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Symbol</TableHead><TableHead>Side</TableHead><TableHead className="text-right">Shares</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {trades.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="num text-muted-foreground">{t.date}</TableCell>
                <TableCell className="font-medium">{t.symbol}</TableCell>
                <TableCell><Badge variant={t.side === "buy" ? "default" : "destructive"} className={t.side === "buy" ? "bg-success text-success-foreground" : ""}>{t.side.toUpperCase()}</Badge></TableCell>
                <TableCell className="text-right num">{t.shares}</TableCell>
                <TableCell className="text-right num">{fmtCurrency(t.price)}</TableCell>
                <TableCell className="text-right num font-medium">{fmtCurrency(t.shares * t.price)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
