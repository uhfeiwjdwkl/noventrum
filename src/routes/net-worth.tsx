import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { EmptyState } from "@/components/finance/EmptyState";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/lib/finance/store";
import { netWorth, totalAssets, totalLiabilities, netWorthSeries, fmtCurrency, fmtPct } from "@/lib/finance/data";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { AddAccountDialog } from "@/components/finance/AddDialogs";
import { useState } from "react";

export const Route = createFileRoute("/net-worth")({
  head: () => ({ meta: [{ title: "Net Worth — Noventrum" }, { name: "description", content: "Assets, liabilities and net worth growth over time." }] }),
  component: NetWorthPage,
});

function NetWorthPage() {
  const accounts = useFinance((s) => s.accounts);
  const transactions = useFinance((s) => s.transactions);
  const [addOpen, setAddOpen] = useState(false);

  const nw = netWorth(accounts);
  const series = netWorthSeries(accounts, transactions);
  const first = series[0]?.value ?? nw;
  const change = first !== 0 ? ((nw - first) / Math.abs(first)) * 100 : 0;
  const assets = accounts.filter((a) => a.balance > 0);
  const liab = accounts.filter((a) => a.balance < 0);
  const ta = totalAssets(accounts);
  const tl = totalLiabilities(accounts);

  if (accounts.length === 0) {
    return (
      <AppShell title="Net Worth" subtitle="Track total wealth across every account." actions={<AddAccountDialog open={addOpen} onOpenChange={setAddOpen} trigger={<Button size="sm">Add account</Button>} />}>
        <EmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title="No accounts yet"
          description="Add your accounts to see your net worth and how it changes over time."
          action={{ label: "Add account", onClick: () => setAddOpen(true) }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Net Worth" subtitle="Track total wealth across every account.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Net Worth" value={nw} change={change} hint="all time" />
        <StatCard label="Assets" value={ta} />
        <StatCard label="Liabilities" value={tl} />
        <StatCard label="Debt Ratio" value={ta > 0 ? (tl / ta) * 100 : 0} currency={false} suffix="%" />
      </div>

      <Card className="p-5 mb-6">
        <div className="mb-4">
          <div className="text-sm text-muted-foreground">Net worth history</div>
          <div className="text-3xl font-semibold num mt-1">{fmtCurrency(nw)}</div>
          {series.length > 1 && <div className={"text-xs mt-1 num " + (change >= 0 ? "text-success" : "text-destructive")}>{fmtPct(change)} over {series.length} months</div>}
        </div>
        <div className="h-80">
          {series.length === 0 ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">Log transactions to see history.</div>
          ) : (
            <ResponsiveContainer>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="nwLarge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, { compact: true })} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmtCurrency(v)} />
                <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#nwLarge)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-semibold">Assets</div>
            <Badge variant="secondary" className="num">{fmtCurrency(ta, { compact: true })}</Badge>
          </div>
          {assets.length === 0 ? <div className="text-sm text-muted-foreground py-4 text-center">No asset accounts.</div> : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Balance</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell><div className="font-medium">{a.name}</div><div className="text-xs text-muted-foreground">{a.institution}</div></TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{a.type}</Badge></TableCell>
                    <TableCell className="text-right num font-medium">{fmtCurrency(a.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-semibold">Liabilities</div>
            <Badge variant="secondary" className="num">{fmtCurrency(tl, { compact: true })}</Badge>
          </div>
          {liab.length === 0 ? <div className="text-sm text-muted-foreground py-4 text-center">No liabilities. 🎉</div> : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Balance</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {liab.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell><div className="font-medium">{a.name}</div><div className="text-xs text-muted-foreground">{a.institution}</div></TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{a.type}</Badge></TableCell>
                    <TableCell className="text-right num font-medium text-destructive">{fmtCurrency(a.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
