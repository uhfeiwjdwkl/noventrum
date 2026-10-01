import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { EmptyState } from "@/components/finance/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinance } from "@/lib/finance/store";
import { fmtCurrency, toBase, type Dividend } from "@/lib/finance/data";
import { AddDividendDialog } from "@/components/finance/ExtraDialogs";
import { BulkControls, SelectBox, useSelection } from "@/components/finance/BulkEdit";
import { TickerFlag } from "@/components/finance/TickerFlag";
import { Coins, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/dividends")({
  head: () => ({ meta: [
    { title: "Dividends — Noventrum" },
    { name: "description", content: "Cash dividends received across your holdings." },
    { property: "og:title", content: "Dividends — Noventrum" },
    { property: "og:description", content: "Cash dividends received across your holdings." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DividendsPage,
});

function DividendsPage() {
  const dividends = useFinance((s) => s.dividends);
  const accounts = useFinance((s) => s.accounts);
  const fxRates = useFinance((s) => s.fxRates);
  const base = useFinance((s) => s.settings.baseCurrency);
  const del = useFinance((s) => s.deleteDividend);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dividend | null>(null);
  const sel = useSelection();

  const b = (d: Dividend, v: number) => toBase(v, d.currency, fxRates, base);
  const gross = dividends.reduce((s, d) => s + b(d, d.amount), 0);
  const tax = dividends.reduce((s, d) => s + b(d, d.tax ?? 0), 0);
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1);
  const ttm = dividends.filter((d) => new Date(d.date) >= cutoff).reduce((s, d) => s + b(d, d.amount - (d.tax ?? 0)), 0);

  const groups = new Map<string, Dividend[]>();
  for (const d of dividends) {
    const k = d.symbol.toUpperCase();
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  const sorted = [...groups.entries()].sort((a, c) => a[0].localeCompare(c[0]));
  sorted.forEach(([, list]) => list.sort((a, c) => (a.date < c.date ? 1 : -1)));
  const all = sorted.flatMap(([, list]) => list.map((d) => ({ type: "div" as const, id: d.id })));

  return (
    <AppShell
      title="Dividends"
      subtitle="Cash income from your investments, grouped by asset."
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
            <StatCard label="Net (last 12 months)" value={ttm} />
            <StatCard label="Payouts" value={dividends.length} currency={false} />
          </div>
          <div className="mb-3"><BulkControls sel={sel} all={all} /></div>
          <div className="space-y-4">
            {sorted.map(([sym, list]) => {
              const net = list.reduce((s, d) => s + b(d, d.amount - (d.tax ?? 0)), 0);
              return (
                <Card key={sym} className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold flex items-center gap-1">{sym} <TickerFlag symbol={sym} /></div>
                    <div className="text-sm text-muted-foreground">{list.length} payout{list.length === 1 ? "" : "s"} · net <span className="num font-medium text-success">{fmtCurrency(net)}</span></div>
                  </div>
                  <Table>
                    <TableHeader><TableRow>
                      {sel.active && <TableHead className="w-8" />}
                      <TableHead>Date</TableHead><TableHead>Account</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead />
                    </TableRow></TableHeader>
                    <TableBody>
                      {list.map((d) => (
                        <TableRow key={d.id}>
                          {sel.active && <TableCell><SelectBox label="Select dividend" checked={sel.has({ type: "div", id: d.id })} onChange={(v) => sel.toggle({ type: "div", id: d.id }, v)} /></TableCell>}
                          <TableCell className="num text-muted-foreground">{d.date}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{accounts.find((a) => a.id === d.accountId)?.name ?? "—"}</TableCell>
                          <TableCell className="text-right num">{fmtCurrency(d.amount, { currency: d.currency })}</TableCell>
                          <TableCell className="text-right num text-muted-foreground">{d.tax ? fmtCurrency(d.tax, { currency: d.currency }) : "—"}</TableCell>
                          <TableCell className="text-right num font-medium text-success">{fmtCurrency(d.amount - (d.tax ?? 0), { currency: d.currency })}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <button aria-label="Edit dividend" onClick={() => setEditing(d)} className="text-muted-foreground hover:text-foreground mr-2"><Pencil className="h-4 w-4" /></button>
                            <button aria-label="Delete dividend" onClick={() => del(d.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              );
            })}
          </div>
        </>
      )}
      {editing && <AddDividendDialog key={editing.id} editDividend={editing} open onOpenChange={(o) => !o && setEditing(null)} />}
    </AppShell>
  );
}
