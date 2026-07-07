import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { EmptyState } from "@/components/finance/EmptyState";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinance } from "@/lib/finance/store";
import { monthlyCashflow, fmtCurrency } from "@/lib/finance/data";
import { FileBarChart } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — Noventrum" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const transactions = useFinance((s) => s.transactions);
  const trades = useFinance((s) => s.trades);
  const dividends = useFinance((s) => s.dividends);
  const holdings = useFinance((s) => s.holdings);

  const cf = monthlyCashflow(transactions);
  const totalIncome = cf.reduce((s, m) => s + m.income, 0);
  const totalExpense = cf.reduce((s, m) => s + m.expense, 0);
  const divTotal = dividends.reduce((s, d) => s + d.amount, 0);
  const interestTotal = transactions.filter((t) => t.category === "Interest").reduce((s, t) => s + t.amount, 0);

  const realized = trades.filter((t) => t.side === "sell").reduce((s, t) => {
    const h = holdings.find((x) => x.symbol === t.symbol);
    return s + (h ? (t.price - h.avgCost) * t.shares : 0);
  }, 0);
  const unrealized = holdings.reduce((s, h) => s + (h.price - h.avgCost) * h.shares, 0);

  const activity = [
    ...transactions.slice(0, 30).map((t) => ({ date: t.date, kind: t.kind, description: `${t.merchant} — ${t.category}`, amount: t.amount })),
    ...trades.map((t) => ({ date: t.date, kind: "trade" as const, description: `${t.side.toUpperCase()} ${t.shares} ${t.symbol}`, amount: t.side === "buy" ? -t.shares * t.price : t.shares * t.price })),
    ...dividends.map((d) => ({ date: d.date, kind: "income" as const, description: `${d.symbol} dividend`, amount: d.amount })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 50);

  if (transactions.length === 0 && trades.length === 0 && dividends.length === 0 && holdings.length === 0) {
    return (
      <AppShell title="Reports" subtitle="Tax summaries, activity and financial statements.">
        <EmptyState
          icon={<FileBarChart className="h-6 w-6" />}
          title="No data yet"
          description="Log transactions or add holdings to generate reports and tax summaries."
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Reports" subtitle="Tax summaries, activity and financial statements.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total income" value={totalIncome} />
        <StatCard label="Total expenses" value={totalExpense} />
        <StatCard label="Realized gains" value={realized} />
        <StatCard label="Unrealized gains" value={unrealized} />
      </div>

      <Tabs defaultValue="tax">
        <TabsList>
          <TabsTrigger value="tax">Tax summary</TabsTrigger>
          <TabsTrigger value="activity">Activity feed</TabsTrigger>
          <TabsTrigger value="summary">Yearly summary</TabsTrigger>
        </TabsList>

        <TabsContent value="tax">
          <Card className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="font-semibold mb-3">Investment income</div>
                <Table>
                  <TableBody>
                    <TableRow><TableCell>Qualified dividends</TableCell><TableCell className="text-right num font-medium">{fmtCurrency(divTotal * 0.85)}</TableCell></TableRow>
                    <TableRow><TableCell>Ordinary dividends</TableCell><TableCell className="text-right num font-medium">{fmtCurrency(divTotal * 0.15)}</TableCell></TableRow>
                    <TableRow><TableCell>Interest income</TableCell><TableCell className="text-right num font-medium">{fmtCurrency(interestTotal)}</TableCell></TableRow>
                    <TableRow><TableCell className="font-semibold">Total</TableCell><TableCell className="text-right num font-semibold">{fmtCurrency(divTotal + interestTotal)}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>
              <div>
                <div className="font-semibold mb-3">Capital gains</div>
                <Table>
                  <TableBody>
                    <TableRow><TableCell>Short-term realized</TableCell><TableCell className="text-right num font-medium">{fmtCurrency(realized * 0.3)}</TableCell></TableRow>
                    <TableRow><TableCell>Long-term realized</TableCell><TableCell className="text-right num font-medium">{fmtCurrency(realized * 0.7)}</TableCell></TableRow>
                    <TableRow><TableCell>Unrealized</TableCell><TableCell className="text-right num font-medium text-muted-foreground">{fmtCurrency(unrealized)}</TableCell></TableRow>
                    <TableRow><TableCell className="font-semibold">Net realized</TableCell><TableCell className="text-right num font-semibold">{fmtCurrency(realized)}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="p-5">
            <div className="font-semibold mb-3">All financial activity</div>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {activity.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="num text-muted-foreground">{a.date}</TableCell>
                    <TableCell className="capitalize text-xs">{a.kind}</TableCell>
                    <TableCell>{a.description}</TableCell>
                    <TableCell className={"text-right num font-medium " + (a.amount > 0 ? "text-success" : "")}>{fmtCurrency(a.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card className="p-5">
            <div className="font-semibold mb-3">Monthly summary</div>
            <Table>
              <TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Income</TableHead><TableHead className="text-right">Expense</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">Savings rate</TableHead></TableRow></TableHeader>
              <TableBody>
                {cf.slice().reverse().map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="num">{m.month}</TableCell>
                    <TableCell className="text-right num text-success">{fmtCurrency(m.income)}</TableCell>
                    <TableCell className="text-right num">{fmtCurrency(m.expense)}</TableCell>
                    <TableCell className={"text-right num font-medium " + (m.net >= 0 ? "text-success" : "text-destructive")}>{fmtCurrency(m.net)}</TableCell>
                    <TableCell className="text-right num text-muted-foreground">{m.income > 0 ? `${(((m.income - m.expense) / m.income) * 100).toFixed(1)}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
