import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useFinance } from "@/lib/finance/store";
import { fmtCurrency } from "@/lib/finance/data";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Value history for a non-digital asset (property or physical item).
 * Each valuation is a date + price; the latest one is the current value.
 */
export function ValuationDialog({ kind, id, open, onOpenChange }: { kind: "property" | "physical"; id: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const asset = useFinance((s) => (kind === "property" ? s.properties : s.physicalAssets).find((a) => a.id === id));
  const add = useFinance((s) => s.addAssetValuation);
  const del = useFinance((s) => s.deleteAssetValuation);
  const [date, setDate] = useState(today());
  const [value, setValue] = useState("");
  const [sel, setSel] = useState<string[]>([]);

  const points = useMemo(() => {
    if (!asset) return [];
    const v = asset.valuations?.length ? asset.valuations : [{ date: asset.purchaseDate, value: asset.purchasePrice }];
    const sorted = [...v].sort((a, b) => (a.date < b.date ? -1 : 1));
    const last = sorted[sorted.length - 1];
    const end = asset.soldDate ?? today();
    return last && last.date < end ? [...sorted, { date: end, value: last.value }] : sorted;
  }, [asset]);

  if (!asset || !id) return null;
  const cur = asset.currency;
  const recorded = asset.valuations?.length ? asset.valuations : [{ date: asset.purchaseDate, value: asset.purchasePrice }];
  const cmp = sel.length === 2 ? (() => {
    const [a, b] = [...sel].sort();
    const va = points.find((p) => p.date === a)?.value ?? 0;
    const vb = points.find((p) => p.date === b)?.value ?? 0;
    return { a, b, gain: vb - va, pct: va ? ((vb - va) / va) * 100 : 0 };
  })() : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(value);
    if (!date || !Number.isFinite(n) || n < 0 || value === "") return;
    add(kind, id!, date, n);
    setValue("");
    toast.success("Valuation added");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset.name}</DialogTitle>
          <DialogDescription>Current value {fmtCurrency(asset.currentValue, { currency: cur })} · bought {asset.purchaseDate} for {fmtCurrency(asset.purchasePrice, { currency: cur })}</DialogDescription>
        </DialogHeader>
        {cmp ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <span>{cmp.a} → {cmp.b}</span>
            <span className={cmp.gain >= 0 ? "text-success" : "text-destructive"}>{fmtCurrency(cmp.gain, { currency: cur })} ({cmp.pct >= 0 ? "+" : ""}{cmp.pct.toFixed(2)}%)</span>
            <Button size="sm" variant="ghost" onClick={() => setSel([])}>Clear</Button>
          </div>
        ) : <div className="text-xs text-muted-foreground">Click two points on the chart to compare value between them.</div>}
        <div className="h-60">
          <ResponsiveContainer>
            <AreaChart data={points} className="cursor-crosshair" onClick={(s) => { const d = typeof s?.activeLabel === "string" ? s.activeLabel : undefined; if (d) setSel((c) => (c.length === 1 ? [c[0], d] : [d])); }}>
              <defs>
                <linearGradient id="valFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" minTickGap={32} />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" domain={["auto", "auto"]} tickFormatter={(v: number) => fmtCurrency(v, { currency: cur, compact: true })} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmtCurrency(v, { currency: cur })} />
              <Area type="stepAfter" dataKey="value" name="Value" stroke="var(--chart-1)" fill="url(#valFill)" strokeWidth={2} dot />
              {sel.length === 2 && <ReferenceArea x1={sel[0]} x2={sel[1]} fill="var(--chart-2)" fillOpacity={0.12} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <div><Label>Date</Label><Input className="mt-1.5 w-40" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Value ({cur})</Label><Input className="mt-1.5 w-40" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <Button type="submit">Add valuation</Button>
        </form>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Value</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {[...recorded].sort((a, b) => (a.date < b.date ? 1 : -1)).map((v) => (
              <TableRow key={v.date}>
                <TableCell className="num">{v.date}</TableCell>
                <TableCell className="text-right num">{fmtCurrency(v.value, { currency: cur })}</TableCell>
                <TableCell className="text-right">
                  {asset.valuations?.length ? <button aria-label="Delete valuation" onClick={() => del(kind, id, v.date)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button> : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
