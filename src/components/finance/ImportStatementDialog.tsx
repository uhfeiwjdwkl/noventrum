import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinance } from "@/lib/finance/store";
import type { AccountType, AssetClass } from "@/lib/finance/data";
import { Upload } from "lucide-react";
import { toast } from "sonner";

type Row = Record<string, string>;

function csvRows(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i <= text.length; i++) {
    const c = text[i] ?? "\n";
    if (c === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += c;
  }
  const headers = (rows.shift() ?? []).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return rows.map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
}

function normalize(input: unknown): Row[] {
  if (Array.isArray(input)) return input as Row[];
  if (input && typeof input === "object") {
    const x = input as Record<string, unknown>;
    return ["transactions", "trades", "accounts"].flatMap((key) => Array.isArray(x[key]) ? (x[key] as Row[]).map((r) => ({ ...r, kind: r.kind || key.slice(0, -1) })) : []);
  }
  return [];
}

export function ImportStatementDialog({ trigger }: { trigger?: React.ReactNode }) {
  const accounts = useFinance((s) => s.accounts);
  const addAccount = useFinance((s) => s.addAccount);
  const addTransaction = useFinance((s) => s.addTransaction);
  const recordTrade = useFinance((s) => s.recordTrade);
  const base = useFinance((s) => s.settings.baseCurrency);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [accountId, setAccountId] = useState("");
  const [newName, setNewName] = useState("");
  const refs = Array.from(new Set(rows.map((r) => r.account || r.account_name).filter(Boolean)));

  async function read(file?: File) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = file.name.toLowerCase().endsWith(".json") ? normalize(JSON.parse(text)) : csvRows(text);
      setRows(parsed);
      toast.success(`Read ${parsed.length} rows`);
    } catch { toast.error("Could not read this statement"); }
  }

  function runImport() {
    let target = accountId;
    if (target === "new") {
      if (!newName.trim()) return;
      target = addAccount({ name: newName.trim(), institution: "Imported statement", type: "brokerage" as AccountType, balance: 0, balanceDate: new Date().toISOString().slice(0, 10), currency: base }).id;
    }
    if (!target) return;
    let count = 0;
    for (const r of rows) {
      const kind = (r.kind || r.type || "transaction").toLowerCase();
      const date = r.date || r.trade_date || r.transaction_date;
      if (!date) continue;
      if (kind === "trade" || r.symbol) {
        const shares = Number(r.shares || r.quantity || r.qty);
        const price = Number(r.price || r.unit_price);
        if (!r.symbol || !shares || !price) continue;
        recordTrade({ date, symbol: r.symbol, name: r.name || r.description || r.symbol, side: (r.side || r.action || "buy").toLowerCase() === "sell" ? "sell" : "buy", shares, price, fees: Number(r.fees || r.fee) || 0, tax: Number(r.tax) || 0, accountId: target, currency: (r.currency || base).toUpperCase(), assetClass: (r.asset_class || "stock") as AssetClass, notes: r.notes });
      } else {
        const amount = Number(r.amount || r.credit || (r.debit ? `-${r.debit}` : ""));
        if (!Number.isFinite(amount)) continue;
        addTransaction({ date, accountId: target, amount, currency: (r.currency || base).toUpperCase(), kind: kind === "fee" ? "expense" : amount >= 0 ? "income" : "expense", category: r.category || (kind === "fee" ? "Fee" : "Imported"), merchant: r.merchant || r.description || r.payee || "Imported transaction", notes: r.notes });
      }
      count++;
    }
    toast.success(`Imported ${count} entries`);
    setRows([]); setOpen(false);
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>{trigger ?? <Button variant="outline"><Upload />Import statement</Button>}</DialogTrigger>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Import account statement</DialogTitle><DialogDescription>Upload CSV or JSON, then link every referenced account to an existing Noventrum account or create a new one.</DialogDescription></DialogHeader>
      <div className="grid gap-4">
        <div><Label>Statement file</Label><Input type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => void read(e.target.files?.[0])} className="mt-1.5" /></div>
        {rows.length > 0 && <>
          <div className="rounded-md border bg-muted/30 p-3 text-sm"><strong>{rows.length}</strong> rows found{refs.length ? ` across: ${refs.join(", ")}` : ""}. The selected destination applies to this import.</div>
          <div><Label>Destination account</Label><Select value={accountId} onValueChange={setAccountId}><SelectTrigger className="mt-1.5"><SelectValue placeholder="Link or create account" /></SelectTrigger><SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}<SelectItem value="new">Create new account…</SelectItem></SelectContent></Select></div>
          {accountId === "new" && <div><Label>New account name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={refs[0] || "Imported brokerage"} className="mt-1.5" /></div>}
        </>}
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!rows.length || !accountId || (accountId === "new" && !newName.trim())} onClick={runImport}>Import entries</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}