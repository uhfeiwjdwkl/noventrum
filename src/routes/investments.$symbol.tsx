import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { PriceChart } from "@/components/finance/PriceChart";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinance } from "@/lib/finance/store";
import { fmtCurrency, fmtPct } from "@/lib/finance/data";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/investments/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} — Noventrum` },
      { name: "description", content: `Price history, trades and dividends for ${params.symbol}.` },
      { property: "og:title", content: `${params.symbol} — Noventrum` },
      { property: "og:description", content: `Price history, trades and dividends for ${params.symbol}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HoldingPage,
  notFoundComponent: () => (
    <AppShell title="Not found"><Card className="p-8 text-center">Asset not found. <Link to="/investments" className="text-primary underline">Back to investments</Link></Card></AppShell>
  ),
});

function HoldingPage() {
  const { symbol } = Route.useParams();
  const holdings = useFinance((s) => s.holdings);
  const trades = useFinance((s) => s.trades);
  const dividends = useFinance((s) => s.dividends);
  const watchlist = useFinance((s) => s.watchlist);

  const h = holdings.find((x) => x.symbol === symbol);
  const w = watchlist.find((x) => x.symbol === symbol);
  const myTrades = trades.filter((t) => t.symbol === symbol);
  if (!h && !w && myTrades.length === 0) throw notFound();

  const myDivs = dividends.filter((d) => d.symbol === symbol);
  const totalDivs = myDivs.reduce((s, d) => s + d.amount, 0);
  const price = h?.price ?? w?.price ?? 0;
  const dayChangePct = h?.dayChangePct ?? w?.dayChangePct ?? 0;
  const currency = h?.currency ?? w?.currency;
  const name = h?.name ?? w?.name ?? symbol;
  const assetClass = h?.assetClass ?? w?.assetClass ?? "other";
  const shares = h?.shares ?? 0;
  const val = shares * price;
  const cost = shares * (h?.avgCost ?? 0);
  const pl = val - cost;
  const plPct = cost > 0 ? (pl / cost) * 100 : 0;

  return (
    <AppShell
      title={`${symbol} — ${name}`}
      subtitle={`${assetClass.toUpperCase()}${h?.sector ? ` • ${h.sector}` : ""}`}
      actions={<Link to="/investments" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />All holdings</Link>}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Current price" value={price} change={dayChangePct} hint="today" />
        <StatCard label="Position value" value={val} change={plPct} hint="all time" />
        <StatCard label="Unrealized P/L" value={pl} />
        <StatCard label="Dividends" value={totalDivs} />
      </div>

      <Card className="p-5 mb-6">
        <PriceChart symbol={symbol} currency={currency} trades={myTrades} height={340} />
      </Card>


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
