import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinance } from "@/lib/finance/store";
import { fmtCurrency, fmtPct } from "@/lib/finance/data";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/investments/$symbol")({
  head: ({ params }) => ({ meta: [{ title: `${params.symbol} — Noventrum` }] }),
  component: HoldingPage,
  notFoundComponent: () => (
    <AppShell title="Not found"><Card className="p-8 text-center">Holding not found. <Link to="/investments" className="text-primary underline">Back to investments</Link></Card></AppShell>
  ),
});

function HoldingPage() {
  const { symbol } = Route.useParams();
  const holdings = useFinance((s) => s.holdings);
  const trades = useFinance((s) => s.trades);
  const dividends = useFinance((s) => s.dividends);

  const h = holdings.find((x) => x.symbol === symbol);
  if (!h) throw notFound();
  const val = h.shares * h.price;
  const cost = h.shares * h.avgCost;
  const pl = val - cost;
  const plPct = cost > 0 ? (pl / cost) * 100 : 0;
  const myTrades = trades.filter((t) => t.symbol === h.symbol);
  const myDivs = dividends.filter((d) => d.symbol === h.symbol);
  const totalDivs = myDivs.reduce((s, d) => s + d.amount, 0);

  return (
    <AppShell
      title={`${h.symbol} — ${h.name}`}
      subtitle={`${h.assetClass.toUpperCase()} • ${h.sector ?? ""}`}
      actions={<Link to="/investments" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />All holdings</Link>}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Current price" value={h.price} change={h.dayChangePct} hint="today" />
        <StatCard label="Position value" value={val} change={plPct} hint="all time" />
        <StatCard label="Unrealized P/L" value={pl} />
        <StatCard label="Dividends" value={totalDivs} />
      </div>

      {h.history.length > 0 && (
        <Card className="p-5 mb-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Price history</div>
              <div className="text-2xl font-semibold num mt-1">{fmtCurrency(h.price)}</div>
            </div>
            <Badge variant="secondary" className={h.dayChangePct >= 0 ? "text-success bg-success/10 border-0" : "text-destructive bg-destructive/10 border-0"}>{fmtPct(h.dayChangePct)}</Badge>
          </div>
          <div className="h-80">
            <ResponsiveContainer>
              <AreaChart data={h.history}>
                <defs>
                  <linearGradient id="ph" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, { compact: true })} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmtCurrency(v)} />
                <Area type="monotone" dataKey="price" stroke="var(--chart-1)" strokeWidth={2} fill="url(#ph)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="mb-4 font-semibold">Position details</div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted-foreground">Shares</dt><dd className="num font-medium">{h.shares}</dd></div>
            <div><dt className="text-muted-foreground">Avg cost</dt><dd className="num font-medium">{fmtCurrency(h.avgCost)}</dd></div>
            <div><dt className="text-muted-foreground">Market value</dt><dd className="num font-medium">{fmtCurrency(val)}</dd></div>
            <div><dt className="text-muted-foreground">Cost basis</dt><dd className="num font-medium">{fmtCurrency(cost)}</dd></div>
            <div><dt className="text-muted-foreground">Unrealized P/L</dt><dd className={"num font-medium " + (pl >= 0 ? "text-success" : "text-destructive")}>{fmtCurrency(pl)}</dd></div>
            <div><dt className="text-muted-foreground">Return</dt><dd className={"num font-medium " + (plPct >= 0 ? "text-success" : "text-destructive")}>{fmtPct(plPct)}</dd></div>
          </dl>
        </Card>

        <Card className="p-5">
          <div className="mb-4 font-semibold">Trade history</div>
          {myTrades.length === 0 ? <div className="text-sm text-muted-foreground">No trades yet.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Side</TableHead><TableHead className="text-right">Shares</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
              <TableBody>
                {myTrades.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="num text-muted-foreground">{t.date}</TableCell>
                    <TableCell><Badge className={t.side === "buy" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>{t.side.toUpperCase()}</Badge></TableCell>
                    <TableCell className="text-right num">{t.shares}</TableCell>
                    <TableCell className="text-right num">{fmtCurrency(t.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 font-semibold">Dividend history</div>
          {myDivs.length === 0 ? <div className="text-sm text-muted-foreground">No dividends recorded.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {myDivs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="num text-muted-foreground">{d.date}</TableCell>
                    <TableCell className="text-right num font-medium text-success">{fmtCurrency(d.amount)}</TableCell>
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
