import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { incomeBySource, monthlyCashflow, transactions, fmtCurrency } from "@/lib/finance/data";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/income")({
  head: () => ({ meta: [{ title: "Income — FinFlow" }, { name: "description", content: "All income sources — salary, dividends, interest and more." }] }),
  component: IncomePage,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

function IncomePage() {
  const cf = monthlyCashflow().slice(-12);
  const total = cf.reduce((s, m) => s + m.income, 0);
  const avg = total / cf.length;
  const sources = incomeBySource();
  const recent = transactions.filter((t) => t.kind === "income").slice(0, 20);

  return (
    <AppShell title="Income" subtitle="Every dollar earned, from every source.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Income (12 mo)" value={total} />
        <StatCard label="Monthly avg" value={avg} />
        <StatCard label="Sources" value={sources.length} currency={false} />
        <StatCard label="This month" value={cf[cf.length - 1]?.income ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 font-semibold">Monthly income</div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={cf}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, { compact: true })} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmtCurrency(v)} />
                <Bar dataKey="income" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <div className="mb-4 font-semibold">Income by source</div>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={sources} dataKey="amount" nameKey="source" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {sources.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmtCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {sources.map((s, i) => (
              <div key={s.source} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{s.source}</div>
                <span className="num text-muted-foreground">{fmtCurrency(s.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 font-semibold">Recent income</div>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>
            {recent.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="num text-muted-foreground">{t.date}</TableCell>
                <TableCell className="font-medium">{t.merchant}</TableCell>
                <TableCell><Badge variant="secondary">{t.category}</Badge></TableCell>
                <TableCell className="text-right num font-medium text-success">{fmtCurrency(t.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
