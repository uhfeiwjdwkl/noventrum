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
import { fmtCurrency, fmtPct, physicalValue } from "@/lib/finance/data";
import { AddPhysicalDialog } from "@/components/finance/ExtraDialogs";
import { Package, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/other-assets")({
  head: () => ({
    meta: [
      { title: "Other Assets — Noventrum" },
      { name: "description", content: "Vehicles, jewelry, art and other physical assets." },
    ],
  }),
  component: OtherAssetsPage,
});

function OtherAssetsPage() {
  const items = useFinance((s) => s.physicalAssets);
  const del = useFinance((s) => s.deletePhysicalAsset);
  const update = useFinance((s) => s.updatePhysicalAsset);
  const [addOpen, setAddOpen] = useState(false);

  const value = physicalValue(items);
  const cost = items.filter((a) => !a.soldDate).reduce((s, a) => s + a.purchasePrice + a.fees + a.tax, 0);

  return (
    <AppShell
      title="Other Assets"
      subtitle="Vehicles, collectibles, jewelry — anything you own outright."
      actions={<AddPhysicalDialog open={addOpen} onOpenChange={setAddOpen} trigger={<Button size="sm">Add asset</Button>} />}
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="No physical assets yet"
          description="Track things like your car, watches, art or gear so they count toward your net worth."
          action={{ label: "Add asset", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total value" value={value} />
            <StatCard label="Cost basis" value={cost} />
            <StatCard label="Unrealized" value={value - cost} />
            <StatCard label="Items" value={items.filter((a) => !a.soldDate).length} currency={false} />
          </div>

          <Card className="p-5">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Purchased</TableHead>
                <TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Change</TableHead><TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {items.map((a) => {
                  const c = a.purchasePrice + a.fees + a.tax;
                  const change = a.currentValue - c;
                  const changePct = c > 0 ? (change / c) * 100 : 0;
                  return (
                    <TableRow key={a.id} className="group">
                      <TableCell>
                        <div className="font-medium">{a.name}</div>
                        {a.soldDate && <Badge variant="outline" className="mt-1">Sold {a.soldDate}</Badge>}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{a.category}</Badge></TableCell>
                      <TableCell className="num text-muted-foreground">{a.purchaseDate}</TableCell>
                      <TableCell className="text-right num">{fmtCurrency(c, { currency: a.currency })}</TableCell>
                      <TableCell className="text-right num">
                        <InlineValue value={a.currentValue} currency={a.currency} onChange={(v) => { update(a.id, { currentValue: v }); toast.success("Value updated"); }} />
                      </TableCell>
                      <TableCell className={"text-right num " + (change >= 0 ? "text-success" : "text-destructive")}>
                        {fmtCurrency(change, { currency: a.currency })} <span className="text-xs">({fmtPct(changePct)})</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <button onClick={() => del(a.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </AppShell>
  );
}

function InlineValue({ value, currency, onChange }: { value: number; currency: string; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value));
  if (!editing) return <button className="hover:underline" onClick={() => { setV(String(value)); setEditing(true); }}>{fmtCurrency(value, { currency })}</button>;
  return (
    <form className="flex gap-1 justify-end" onSubmit={(e) => { e.preventDefault(); onChange(Number(v) || 0); setEditing(false); }}>
      <Input autoFocus className="h-7 w-28 num text-right" type="number" step="0.01" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => setEditing(false)} />
    </form>
  );
}
