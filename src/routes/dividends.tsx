import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { EmptyState } from "@/components/finance/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinance } from "@/lib/finance/store";
import { fmtCurrency } from "@/lib/finance/data";
import { AddDividendDialog } from "@/components/finance/ExtraDialogs";
import { Coins, Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/dividends")({
  head: () => ({ meta: [{ title: "Dividends — Noventrum" }, { name: "description", content: "Cash dividends received across your holdings." }] }),
  component: DividendsPage,
});

function DividendsPage() {
  const dividends = useFinance((s) => s.dividends);
  const del = useFinance((s) => s.deleteDividend);
  const [open, setOpen] = useState(false);

  const gross = dividends.reduce((s, d) => s + d.amount, 0);
  const tax = dividends.reduce((s, d) => s + (d.tax ?? 0), 0);
  const bySymbol = new Map<string, number>();
  dividends.forEach((d) => bySymbol.set(d.symbol, (bySymbol.get(d.symbol) ?? 0) + d.amount - (d.tax ?? 0)));
  const cutoff12 = new Date(); cutoff12.setFullYear(cutoff12.getFullYear() - 1);
  const ttm = dividends.filter((d) => new Date(d.date) >= cutoff12).reduce((s, d) => s + d.amount - (d.tax ?? 0), 0);

  return (
    <AppShell
      title="Dividends"
      subtitle="Cash income from your investments."
      actions={<AddDividendDialog open={open} onOpenChange={setOpen} trigger={<Button size="sm">Log dividend</Button>} />}
    >
      {dividends.length === 0 ? (
        <EmptyState
          icon={<Coins className="h-6 w-6" />}
          title="No dividends yet"
          description="Log dividend payouts to keep your investment returns accurate."
          action={{ label: "Log dividend", onClick: () => setOpen(true) }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Gross received" value={gross} />
            <StatCard label="Tax withheld" value={tax} />
            <StatCard label="Net (TTM)" value={ttm} />
            <StatCard label="Payouts" value={dividends.length} currency={false} />
          </div>

          <Card className="p-5">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Symbol</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {dividends.map((d) => (
                  <TableRow key={d.id} className="group">
                    <TableCell className="num text-muted-foreground">{d.date}</TableCell>
                    <TableCell><Badge variant="secondary">{d.symbol}</Badge></TableCell>
                    <TableCell className="text-right num">{fmtCurrency(d.amount, { currency: d.currency })}</TableCell>
                    <TableCell className="text-right num text-muted-foreground">{d.tax ? fmtCurrency(d.tax, { currency: d.currency }) : "—"}</TableCell>
                    <TableCell className="text-right num font-medium text-success">{fmtCurrency(d.amount - (d.tax ?? 0), { currency: d.currency })}</TableCell>
                    <TableCell className="text-right">
                      <button onClick={() => del(d.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </TableCell>
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
