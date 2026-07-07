import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { EmptyState } from "@/components/finance/EmptyState";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useFinance } from "@/lib/finance/store";
import { spendingByCategory, monthlyCashflow, fmtCurrency } from "@/lib/finance/data";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpCircle } from "lucide-react";
import { AddTransactionDialog } from "@/components/finance/AddDialogs";
import { useState } from "react";

export const Route = createFileRoute("/expenses")({
  head: () => ({ meta: [{ title: "Expenses — Noventrum" }, { name: "description", content: "Where your money goes, broken down by category." }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const transactions = useFinance((s) => s.transactions);
  const budgets = useFinance((s) => s.budgets);
  const [addOpen, setAddOpen] = useState(false);

  const cf = monthlyCashflow(transactions).slice(-12);
  const total = cf.reduce((s, m) => s + m.expense, 0);
  const avg = cf.length ? total / cf.length : 0;
  const cats = spendingByCategory(transactions);
  const recent = transactions.filter((t) => t.kind === "expense").slice(0, 25);
  const catMax = cats.length ? Math.max(...cats.map((c) => c.amount)) : 0;

  const hasExpenses = recent.length > 0 || total > 0;

  return (
    <AppShell
      title="Expenses"
      subtitle="Understand your spending patterns."
      actions={<AddTransactionDialog open={addOpen} onOpenChange={setAddOpen} defaultKind="expense" trigger={<Button size="sm">Log expense</Button>} />}
    >
      {!hasExpenses ? (
        <EmptyState
          icon={<ArrowUpCircle className="h-6 w-6" />}
          title="No expenses logged"
          description="Log a purchase to start understanding where your money goes."
          action={{ label: "Log expense", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Expenses (12 mo)" value={total} />
            <StatCard label="Monthly avg" value={avg} />
            <StatCard label="This month" value={cf[cf.length - 1]?.expense ?? 0} />
            <StatCard label="Categories" value={cats.length} currency={false} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Card className="p-5 lg:col-span-2">
              <div className="mb-4 font-semibold">Monthly expenses</div>
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={cf}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, { compact: true })} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmtCurrency(v)} />
                    <Bar dataKey="expense" fill="var(--chart-5)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <div className="mb-4 font-semibold">By category (30d)</div>
              {cats.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">No expenses in last 30 days.</div>
              ) : (
                <div className="space-y-3">
                  {cats.slice(0, 8).map((c) => {
                    const budget = budgets.find((b) => b.category === c.category);
                    return (
                      <div key={c.category}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium">{c.category}</span>
                          <span className="num text-muted-foreground">{fmtCurrency(c.amount)}</span>
                        </div>
                        <Progress value={catMax ? (c.amount / catMax) * 100 : 0} />
                        {budget && <div className="text-xs text-muted-foreground mt-0.5">of {fmtCurrency(budget.limit)} budget</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <div className="mb-4 font-semibold">Recent expenses</div>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Merchant</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {recent.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="num text-muted-foreground">{t.date}</TableCell>
                    <TableCell className="font-medium">{t.merchant}</TableCell>
                    <TableCell><Badge variant="secondary">{t.category}</Badge></TableCell>
                    <TableCell className="text-right num font-medium">{fmtCurrency(t.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </AppShell>
  );
}
