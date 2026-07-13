import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { EmptyState } from "@/components/finance/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinance } from "@/lib/finance/store";
import { fmtCurrency, fmtPct, propertyValue } from "@/lib/finance/data";
import { AddPropertyDialog } from "@/components/finance/ExtraDialogs";
import { Home, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/property")({
  head: () => ({
    meta: [
      { title: "Property — Noventrum" },
      { name: "description", content: "Real estate holdings with valuations and linked mortgages." },
    ],
  }),
  component: PropertyPage,
});

function PropertyPage() {
  const properties = useFinance((s) => s.properties);
  const accounts = useFinance((s) => s.accounts);
  const del = useFinance((s) => s.deleteProperty);
  const addVal = useFinance((s) => s.addPropertyValuation);
  const sell = useFinance((s) => s.updateProperty);
  const [addOpen, setAddOpen] = useState(false);

  const value = propertyValue(properties);
  const cost = properties.filter((p) => !p.soldDate).reduce((s, p) => s + p.purchasePrice + p.fees + p.tax, 0);
  const mortgage = properties.reduce((s, p) => {
    if (!p.linkedMortgageAccountId) return s;
    const a = accounts.find((x) => x.id === p.linkedMortgageAccountId);
    return s + (a ? -a.balance : 0); // liability balances are negative
  }, 0);
  const equity = value - mortgage;

  return (
    <AppShell
      title="Property"
      subtitle="Real estate valuations, cost basis and equity."
      actions={<AddPropertyDialog open={addOpen} onOpenChange={setAddOpen} trigger={<Button size="sm">Add property</Button>} />}
    >
      {properties.length === 0 ? (
        <EmptyState
          icon={<Home className="h-6 w-6" />}
          title="No property yet"
          description="Add real estate you own — home, rental, land. Fees and stamp duty roll into cost basis."
          action={{ label: "Add property", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total value" value={value} />
            <StatCard label="Cost basis" value={cost} />
            <StatCard label="Mortgage debt" value={mortgage} />
            <StatCard label="Equity" value={equity} />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {properties.map((p) => {
              const gain = p.currentValue - p.purchasePrice - p.fees - p.tax;
              const gainPct = p.purchasePrice > 0 ? (gain / p.purchasePrice) * 100 : 0;
              const mort = p.linkedMortgageAccountId
                ? accounts.find((a) => a.id === p.linkedMortgageAccountId)
                : null;
              return (
                <Card key={p.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold">{p.name}</h3>
                        {p.soldDate && <Badge variant="outline">Sold {p.soldDate}</Badge>}
                        <Badge variant="secondary" className="capitalize">{p.currency}</Badge>
                      </div>
                      {p.address && <div className="text-sm text-muted-foreground">{p.address}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-semibold num">{fmtCurrency(p.currentValue, { currency: p.currency })}</div>
                      <div className={"text-xs num " + (gain >= 0 ? "text-success" : "text-destructive")}>{fmtCurrency(gain, { currency: p.currency })} ({fmtPct(gainPct)})</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-xs">
                    <div><div className="text-muted-foreground">Purchased</div><div className="num">{p.purchaseDate}</div></div>
                    <div><div className="text-muted-foreground">Purchase price</div><div className="num">{fmtCurrency(p.purchasePrice, { currency: p.currency })}</div></div>
                    <div><div className="text-muted-foreground">Fees</div><div className="num">{fmtCurrency(p.fees, { currency: p.currency })}</div></div>
                    <div><div className="text-muted-foreground">Tax / duty</div><div className="num">{fmtCurrency(p.tax, { currency: p.currency })}</div></div>
                    <div><div className="text-muted-foreground">Mortgage</div><div className="num">{mort ? fmtCurrency(-mort.balance, { currency: mort.currency }) : "—"}</div></div>
                  </div>

                  {!p.soldDate && (
                    <div className="mt-4 flex flex-wrap gap-2 items-end">
                      <ValuationForm onSubmit={(date, value) => { addVal(p.id, date, value); toast.success("Valuation updated"); }} />
                      <SellForm onSubmit={(date, price) => { sell(p.id, { soldDate: date, soldPrice: price, currentValue: price }); toast.success("Marked as sold"); }} />
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(p.id)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                    </div>
                  )}

                  {p.valuations.length > 1 && (
                    <div className="mt-4">
                      <div className="text-xs text-muted-foreground mb-2">Valuation history</div>
                      <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                        <TableBody>{p.valuations.slice().reverse().map((v, i) => (
                          <TableRow key={i}><TableCell className="num">{v.date}</TableCell><TableCell className="text-right num">{fmtCurrency(v.value, { currency: p.currency })}</TableCell></TableRow>
                        ))}</TableBody>
                      </Table>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );
}

function ValuationForm({ onSubmit }: { onSubmit: (date: string, value: number) => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");
  return (
    <form className="flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); if (!value) return; onSubmit(date, Number(value)); setValue(""); }}>
      <div><label className="text-xs text-muted-foreground">New valuation date</label><Input className="h-8" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div><label className="text-xs text-muted-foreground">Value</label><Input className="h-8 w-32" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" /></div>
      <Button size="sm" type="submit" variant="outline">Update</Button>
    </form>
  );
}

function SellForm({ onSubmit }: { onSubmit: (date: string, price: number) => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [price, setPrice] = useState("");
  return (
    <form className="flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); if (!price) return; onSubmit(date, Number(price)); setPrice(""); }}>
      <div><label className="text-xs text-muted-foreground">Sell date</label><Input className="h-8" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div><label className="text-xs text-muted-foreground">Sale price</label><Input className="h-8 w-32" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
      <Button size="sm" type="submit" variant="outline">Mark sold</Button>
    </form>
  );
}
