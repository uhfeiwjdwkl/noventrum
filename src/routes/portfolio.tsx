import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { holdings, portfolioValue, portfolioCost, assetAllocation, fmtCurrency, fmtPct } from "@/lib/finance/data";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio — FinFlow" }] }),
  component: PortfolioPage,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

function PortfolioPage() {
  const pv = portfolioValue();
  const pc = portfolioCost();
  const pl = pv - pc;
  const alloc = assetAllocation();
  const bySector = new Map<string, number>();
  holdings.forEach((h) => bySector.set(h.sector ?? "Other", (bySector.get(h.sector ?? "Other") ?? 0) + h.shares * h.price));
  const sectors = Array.from(bySector.entries()).map(([sector, value]) => ({ sector, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  const perf = holdings.map((h) => ({ symbol: h.symbol, ret: ((h.price - h.avgCost) / h.avgCost) * 100 })).sort((a, b) => b.ret - a.ret);

  return (
    <AppShell title="Portfolio" subtitle="Positions, allocation and performance.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total value" value={pv} change={(pl / pc) * 100} />
        <StatCard label="Cost basis" value={pc} />
        <StatCard label="Gain/Loss" value={pl} />
        <StatCard label="Positions" value={holdings.length} currency={false} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <div className="mb-4 font-semibold">Allocation by asset class</div>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={alloc} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {alloc.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmtCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <div className="mb-4 font-semibold">Allocation by sector</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={sectors} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, { compact: true })} />
                <YAxis type="category" dataKey="sector" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={100} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmtCurrency(v)} />
                <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 font-semibold">Performance by holding</div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={perf}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="symbol" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => `${v.toFixed(2)}%`} />
              <Bar dataKey="ret" radius={[4, 4, 0, 0]}>
                {perf.map((p, i) => <Cell key={i} fill={p.ret >= 0 ? "var(--chart-1)" : "var(--chart-5)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </AppShell>
  );
}
