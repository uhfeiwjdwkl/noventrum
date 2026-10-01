import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useFinance } from "@/lib/finance/store";

/** A row in any ledger: a plain cash entry, a trade, or a dividend. */
export type LedgerRef = { type: "txn" | "trade" | "div"; id: string };
export const refKey = (r: LedgerRef) => `${r.type}:${r.id}`;

/** Resolve a cash transaction to the record that owns it (trade / dividend / itself). */
export function refForTxn(t: { id: string; tradeId?: string; dividendId?: string }): LedgerRef {
  if (t.tradeId) return { type: "trade", id: t.tradeId };
  if (t.dividendId) return { type: "div", id: t.dividendId };
  return { type: "txn", id: t.id };
}

export function SelectBox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <Checkbox aria-label={label} checked={checked} onCheckedChange={(v) => onChange(v === true)} />;
}

/** Selection state helper for ledgers. */
export function useSelection() {
  const [sel, setSel] = useState<Map<string, LedgerRef>>(new Map());
  const [active, setActive] = useState(false);
  return {
    active,
    start: () => setActive(true),
    stop: () => { setActive(false); setSel(new Map()); },
    selected: [...sel.values()],
    has: (r: LedgerRef) => sel.has(refKey(r)),
    toggle: (r: LedgerRef, on: boolean) =>
      setSel((m) => { const n = new Map(m); if (on) n.set(refKey(r), r); else n.delete(refKey(r)); return n; }),
    setAll: (rs: LedgerRef[], on: boolean) =>
      setSel(() => (on ? new Map(rs.map((r) => [refKey(r), r])) : new Map())),
    clear: () => setSel(new Map()),
  };
}

/** "Bulk edit" button that reveals selection boxes; shows the action bar while active. */
export function BulkControls({ sel, all }: { sel: ReturnType<typeof useSelection>; all: LedgerRef[] }) {
  if (!sel.active)
    return <Button size="sm" variant="outline" className="gap-1" onClick={sel.start}><Pencil className="h-3.5 w-3.5" />Bulk edit</Button>;
  const allOn = all.length > 0 && all.every((r) => sel.has(r));
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
      <SelectBox label="Select all" checked={allOn} onChange={(v) => sel.setAll(all, v)} />
      <span><strong>{sel.selected.length}</strong> selected</span>
      <BulkActions selected={sel.selected} onDone={sel.clear} />
      <Button size="sm" variant="ghost" onClick={sel.stop}>Done</Button>
    </div>
  );
}

function BulkActions({ selected, onDone }: { selected: LedgerRef[]; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const deleteTransactions = useFinance((s) => s.deleteTransactions);
  const deleteTrades = useFinance((s) => s.deleteTrades);
  const deleteDividends = useFinance((s) => s.deleteDividends);
  const none = selected.length === 0;
  function remove() {
    if (!confirm(`Delete ${selected.length} selected entr${selected.length === 1 ? "y" : "ies"}?`)) return;
    deleteTrades(selected.filter((r) => r.type === "trade").map((r) => r.id));
    deleteDividends(selected.filter((r) => r.type === "div").map((r) => r.id));
    deleteTransactions(selected.filter((r) => r.type === "txn").map((r) => r.id));
    toast.success("Deleted");
    onDone();
  }
  return (
    <>
      <Button size="sm" variant="outline" disabled={none} onClick={() => setEditing(true)}>Edit selected</Button>
      <Button size="sm" variant="outline" disabled={none} className="gap-1 text-destructive" onClick={remove}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
      {editing && <BulkEditDialog selected={selected} onClose={() => setEditing(false)} onDone={onDone} />}
    </>
  );
}

/** Toolbar shown when ledger rows are selected. */
export function BulkBar({ selected, onDone }: { selected: LedgerRef[]; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const deleteTransactions = useFinance((s) => s.deleteTransactions);
  const deleteTrades = useFinance((s) => s.deleteTrades);
  const deleteDividends = useFinance((s) => s.deleteDividends);
  if (selected.length === 0) return null;
  function remove() {
    if (!confirm(`Delete ${selected.length} selected entr${selected.length === 1 ? "y" : "ies"}?`)) return;
    deleteTrades(selected.filter((r) => r.type === "trade").map((r) => r.id));
    deleteDividends(selected.filter((r) => r.type === "div").map((r) => r.id));
    deleteTransactions(selected.filter((r) => r.type === "txn").map((r) => r.id));
    toast.success("Deleted");
    onDone();
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
      <span><strong>{selected.length}</strong> selected</span>
      <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />Bulk edit</Button>
      <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={remove}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
      <Button size="sm" variant="ghost" onClick={onDone}>Clear</Button>
      {editing && <BulkEditDialog selected={selected} onClose={() => setEditing(false)} onDone={onDone} />}
    </div>
  );
}

const KEEP = "__keep";

function BulkEditDialog({ selected, onClose, onDone }: { selected: LedgerRef[]; onClose: () => void; onDone: () => void }) {
  const accounts = useFinance((s) => s.accounts);
  const bulkUpdateTrades = useFinance((s) => s.bulkUpdateTrades);
  const bulkUpdateTransactions = useFinance((s) => s.bulkUpdateTransactions);
  const updateDividend = useFinance((s) => s.updateDividend);
  const [date, setDate] = useState("");
  const [account, setAccount] = useState(KEEP);
  const [currency, setCurrency] = useState("");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [side, setSide] = useState(KEEP);
  const [category, setCategory] = useState("");
  const n = { trade: 0, div: 0, txn: 0 };
  selected.forEach((r) => n[r.type]++);

  function apply() {
    const common: Record<string, unknown> = {};
    if (date) common.date = date;
    if (account !== KEEP) common.accountId = account;
    if (currency.trim()) common.currency = currency.trim().toUpperCase();
    const trade: Record<string, unknown> = { ...common };
    if (symbol.trim()) trade.symbol = symbol.trim().toUpperCase();
    if (name.trim()) trade.name = name.trim();
    if (price && Number(price) > 0) trade.price = Number(price);
    if (side !== KEEP) trade.side = side;
    const div: Record<string, unknown> = { ...common };
    if (symbol.trim()) div.symbol = symbol.trim().toUpperCase();
    const txn: Record<string, unknown> = { ...common };
    if (category.trim()) txn.category = category.trim();
    if (name.trim()) txn.merchant = name.trim();
    bulkUpdateTrades(selected.filter((r) => r.type === "trade").map((r) => r.id), trade);
    bulkUpdateTransactions(selected.filter((r) => r.type === "txn").map((r) => r.id), txn);
    selected.filter((r) => r.type === "div").forEach((r) => updateDividend(r.id, div));
    toast.success(`Updated ${selected.length} entries`);
    onClose();
    onDone();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk edit {selected.length} entries</DialogTitle>
          <DialogDescription>
            {n.trade} trades · {n.div} dividends · {n.txn} other. Leave a field blank to keep each entry's current value.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date</Label><Input className="mt-1.5" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div>
            <Label>Account</Label>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep current</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Currency</Label><Input className="mt-1.5" value={currency} maxLength={5} placeholder="e.g. USD" onChange={(e) => setCurrency(e.target.value)} /></div>
          {(n.trade > 0 || n.div > 0) && <div><Label>Ticker</Label><Input className="mt-1.5" value={symbol} placeholder="e.g. AAPL" onChange={(e) => setSymbol(e.target.value)} /></div>}
          <div><Label>{n.trade > 0 ? "Asset name" : "Description"}</Label><Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} /></div>
          {n.trade > 0 && <div><Label>Price per unit</Label><Input className="mt-1.5" type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} /></div>}
          {n.trade > 0 && (
            <div>
              <Label>Side</Label>
              <Select value={side} onValueChange={setSide}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Keep current</SelectItem>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {n.txn > 0 && <div><Label>Category</Label><Input className="mt-1.5" value={category} onChange={(e) => setCategory(e.target.value)} /></div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={apply}>Apply to all</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
