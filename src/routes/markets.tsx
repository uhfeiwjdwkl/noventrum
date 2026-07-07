import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/finance/EmptyState";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFinance } from "@/lib/finance/store";
import { fmtCurrency, fmtPct } from "@/lib/finance/data";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { Search, CandlestickChart } from "lucide-react";
import { useMemo, useState } from "react";
import { AddHoldingDialog } from "@/components/finance/AddDialogs";

export const Route = createFileRoute("/markets")({
  head: () => ({ meta: [{ title: "Markets — Noventrum" }] }),
  component: MarketsPage,
});

function MarketsPage() {
  const holdings = useFinance((s) => s.holdings);
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const filtered = useMemo(() => holdings.filter((h) => !q || h.symbol.toLowerCase().includes(q.toLowerCase()) || h.name.toLowerCase().includes(q.toLowerCase())), [holdings, q]);

  return (
    <AppShell
      title="Markets"
      subtitle="Your watchlist of tracked instruments."
      actions={<AddHoldingDialog open={addOpen} onOpenChange={setAddOpen} trigger={<Button size="sm">Add to watchlist</Button>} />}
    >
      {holdings.length === 0 ? (
        <EmptyState
          icon={<CandlestickChart className="h-6 w-6" />}
          title="Your watchlist is empty"
          description="Add holdings to see quotes and price sparklines here."
          action={{ label: "Add holding", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <>
          <Card className="p-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tickers or names…" className="pl-9" />
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((h) => (
              <Link key={h.id} to="/investments/$symbol" params={{ symbol: h.symbol }}>
                <Card className="p-5 hover:border-primary/50 transition-colors gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{h.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[140px]">{h.name}</div>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs">{h.assetClass}</Badge>
                  </div>
                  {h.history.length > 0 && (
                    <div className="h-16">
                      <ResponsiveContainer>
                        <LineChart data={h.history.slice(-30)}>
                          <Line type="monotone" dataKey="price" stroke={h.dayChangePct >= 0 ? "var(--chart-1)" : "var(--chart-5)"} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between">
                    <div className="text-lg font-semibold num">{fmtCurrency(h.price)}</div>
                    <div className={"text-sm font-medium num " + (h.dayChangePct >= 0 ? "text-success" : "text-destructive")}>{fmtPct(h.dayChangePct)}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
