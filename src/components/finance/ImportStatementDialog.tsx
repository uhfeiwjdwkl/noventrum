import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinance } from "@/lib/finance/store";
import { searchSymbols } from "@/lib/prices.functions";
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

// ---------- shared parsing helpers ----------

function parseMoney(s: string): number {
  if (!s) return NaN;
  const bare = s.replace(/[A-Za-z$€£,\s]/g, "");
  const neg = /^\(.*\)$/.test(bare);
  const n = Number(neg ? bare.slice(1, -1) : bare);
  return neg ? -n : n;
}

function currencyFrom(s: string, fallback: string): string {
  if (/A\$/i.test(s) || /\bAUD\b/i.test(s)) return "AUD";
  if (/US\$/i.test(s) || /\bUSD\b/i.test(s)) return "USD";
  if (/NZ\$/i.test(s)) return "NZD";
  if (/£/.test(s)) return "GBP";
  if (/€/.test(s)) return "EUR";
  if (/¥/.test(s)) return "JPY";
  return fallback;
}

function parseDate(s: string): string {
  const t = (s || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yr}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// ---------- parsed-entry model ----------

type ParsedKind = "trade" | "dividend" | "transaction" | "skip";

interface Parsed {
  key: string;
  kind: ParsedKind;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  symbol?: string;
  name?: string;
  side?: "buy" | "sell";
  shares?: number;
  price?: number;
  fees?: number;
  dup?: string;
  dupTradeId?: string;
  dupTxnId?: string;
  dupDivId?: string;
  action: "add" | "skip" | "update";
  reason?: string;
}

function kindLabel(k: ParsedKind): string {
  return k === "trade" ? "Trade" : k === "dividend" ? "Dividend" : k === "skip" ? "Ignored" : "Transaction";
}

// ---------- Superhero ----------

function parseSuperhero(rows: Row[], fallbackCurrency: string): Parsed[] {
  const out: Parsed[] = [];
  rows.forEach((r, i) => {
    const category = (r.category || r.type || "").trim();
    const merchant = (r.merchant || r.description || "").trim();
    const date = parseDate(r.date || r.transaction_date);
    const amount = parseMoney(r.amount || r.credit || (r.debit ? `-${r.debit}` : ""));
    const base = { key: `${i}`, date, merchant, category, amount, currency: currencyFrom(r.amount || "", fallbackCurrency) } as Parsed;
    if (!date || !Number.isFinite(amount)) return;
    const cat = category.toLowerCase();

    // Settlement, transfer and journal rows are internal bookkeeping — never import.
    if (cat === "trade settlement" || cat === "settlement") {
      out.push({ ...base, kind: "skip", action: "skip", reason: "Trade settlement (auto-generated)" });
      return;
    }
    if (cat === "transfer") {
      out.push({ ...base, kind: "skip", action: "skip", reason: "Internal transfer" });
      return;
    }

    if (cat === "dividend" || /dividend from (.+)$/i.test(merchant)) {
      const m = merchant.match(/dividend from (.+)$/i);
      out.push({ ...base, kind: "dividend", name: m ? m[1].trim() : merchant, action: "add" });
      return;
    }

    if (cat === "buy" || cat === "sell" || cat === "buy (drp)" || cat === "sell (drp)") {
      // Merchant is "TICKER\nBUY 40 @ 11.86 fees 2"
      const lines = merchant.split(/\n|\s{2,}/).map((l) => l.trim()).filter(Boolean);
      const symbol = lines[0]?.toUpperCase();
      const detail = lines.slice(1).join(" ");
      const m = detail.match(/(BUY|SELL)\s+([\d.,]+)\s*@\s*\$?([\d.,]+)/i);
      if (symbol && m) {
        const fees = detail.match(/fees?\s*\$?([\d.,]+)/i);
        out.push({
          ...base,
          kind: "trade",
          symbol,
          side: m[1].toLowerCase() as "buy" | "sell",
          shares: Number(m[2].replace(/,/g, "")),
          price: Number(m[3].replace(/,/g, "")),
          fees: fees ? Number(fees[1].replace(/,/g, "")) : 0,
          action: "add",
        });
        return;
      }
      out.push({ ...base, kind: "skip", action: "skip", reason: "Could not read trade details" });
      return;
    }

    out.push({ ...base, kind: "transaction", action: "add" });
  });
  return out;
}

// ---------- NAB ----------

function parseNab(rows: Row[], fallbackCurrency: string): Parsed[] {
  const out: Parsed[] = [];
  rows.forEach((r, i) => {
    const date = parseDate(r.transaction_date || r.value_date || r.date);
    const amount = parseMoney(r.transaction_amount || r.amount || (r.debit ? `-${r.debit}` : ""));
    const merchant = (r.transaction_description || r.description || r.merchant || "").trim();
    if (!date || !Number.isFinite(amount)) return;
    const currency = currencyFrom(r.transaction_amount || "", fallbackCurrency);
    const type = (r.transaction_type || "").toLowerCase();
    if (/opening balance|closing balance/.test(type)) return;
    out.push({ key: `${i}`, kind: "transaction", date, merchant, category: r.transaction_type || "Imported", amount, currency, action: "add" });
  });
  return out;
}

// ---------- Generic ----------

function parseGeneric(rows: Row[], fallbackCurrency: string): Parsed[] {
  const out: Parsed[] = [];
  rows.forEach((r, i) => {
    const kind = (r.kind || r.type || "transaction").toLowerCase();
    const date = parseDate(r.date || r.trade_date || r.transaction_date);
    if (!date) return;
    const merchant = r.merchant || r.description || r.payee || "";
    const amount = parseMoney(r.amount || r.credit || (r.debit ? `-${r.debit}` : ""));
    const currency = currencyFrom(r.amount || r.currency || "", fallbackCurrency);
    if (kind === "trade" || r.symbol) {
      const shares = Number(r.shares || r.quantity || r.qty);
      const price = Number(r.price || r.unit_price);
      if (!r.symbol || !shares || !price) return;
      out.push({ key: `${i}`, kind: "trade", date, merchant, category: "trade", amount, currency, symbol: r.symbol.toUpperCase(), name: r.name, side: (r.side || r.action || "buy").toLowerCase() === "sell" ? "sell" : "buy", shares, price, fees: Number(r.fees || r.fee) || 0, action: "add" });
      return;
    }
    if (!Number.isFinite(amount)) return;
    out.push({ key: `${i}`, kind: "transaction", date, merchant, category: r.category || "Imported", amount, currency, action: "add" });
  });
  return out;
}

// ---------- asset-name → ticker resolution ----------

async function resolveTickerForName(name: string): Promise<{ symbol: string; name: string } | null> {
  const state = useFinance.getState();
  const n = norm(name);
  if (!n) return null;
  // 1. first holding whose asset name matches
  const seen = new Map<string, string>();
  for (const t of state.trades) if (t.name) seen.set(t.symbol.toUpperCase(), t.name);
  for (const [symbol, hName] of seen) {
    const hn = norm(hName);
    if (hn && (hn.includes(n) || n.includes(hn))) return { symbol, name: hName };
  }
  // 2. public ticker search
  try {
    const matches = await searchSymbols({ query: name });
    const hit = matches.find((m) => norm(m.name).includes(n) || n.includes(norm(m.name))) ?? matches[0];
    if (hit) return { symbol: hit.symbol, name: hit.name };
  } catch {
    // offline / lookup failure — keep the extracted name
  }
  return null;
}

async function resolveNameForSymbol(symbol: string): Promise<string> {
  const state = useFinance.getState();
  const held = state.trades.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
  if (held?.name) return held.name;
  try {
    const matches = await searchSymbols({ query: symbol });
    const hit = matches.find((m) => m.symbol.toUpperCase() === symbol.toUpperCase()) ?? matches[0];
    if (hit?.name) return hit.name;
  } catch {
    // fall through
  }
  return symbol;
}

// ---------- component ----------

export function ImportStatementDialog({ trigger }: { trigger?: ReactNode }) {
  const accounts = useFinance((s) => s.accounts);
  const addAccount = useFinance((s) => s.addAccount);
  const addTransaction = useFinance((s) => s.addTransaction);
  const recordTrade = useFinance((s) => s.recordTrade);
  const updateTrade = useFinance((s) => s.updateTrade);
  const addDividend = useFinance((s) => s.addDividend);
  const updateDividend = useFinance((s) => s.updateDividend);
  const transactions = useFinance((s) => s.transactions);
  const trades = useFinance((s) => s.trades);
  const dividends = useFinance((s) => s.dividends);
  const base = useFinance((s) => s.settings.baseCurrency);

  const [open, setOpen] = useState(false);
  const [institution, setInstitution] = useState<string>("generic");
  const [parsed, setParsed] = useState<Parsed[]>([]);
  const [accountId, setAccountId] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const refs = Array.from(new Set(parsed.map((p) => p.merchant.split("\n")[0]).filter(Boolean)));
  const importable = parsed.filter((p) => p.kind !== "skip");

  async function read(file?: File) {
    if (!file) return;
    try {
      const text = await file.text();
      const rows = file.name.toLowerCase().endsWith(".json") ? normalize(JSON.parse(text)) : csvRows(text);
      let out: Parsed[];
      if (institution === "superhero") out = parseSuperhero(rows, base);
      else if (institution === "nab") out = parseNab(rows, base);
      else out = parseGeneric(rows, base);
      // Resolve names: dividends get a ticker, trades get a proper asset name.
      setBusy(true);
      const seenNames = new Map<string, { symbol: string; name: string } | null>();
      for (const p of out) {
        if (p.kind === "dividend" && p.name && !p.symbol) {
          if (!seenNames.has(p.name)) seenNames.set(p.name, await resolveTickerForName(p.name));
          const hit = seenNames.get(p.name);
          if (hit) { p.symbol = hit.symbol; p.name = hit.name; }
        }
      }
      const seenSymbols = new Map<string, string>();
      for (const p of out) {
        if (p.kind === "trade" && p.symbol && !p.name) {
          if (!seenSymbols.has(p.symbol)) seenSymbols.set(p.symbol, await resolveNameForSymbol(p.symbol));
          p.name = seenSymbols.get(p.symbol);
        }
      }
      setBusy(false);
      setParsed(out);
      toast.success(`Read ${out.length} rows (${out.filter((p) => p.kind !== "skip").length} importable)`);
    } catch {
      setBusy(false);
      toast.error("Could not read this statement");
    }
  }

  // Pure duplicate review: flags rows that already exist in the chosen account.
  function reviewed(list: Parsed[], target: string): Parsed[] {
    return list.map((p) => {
      if (p.kind === "skip") return p;
      let dup = "";
      let dupTradeId: string | undefined;
      let dupTxnId: string | undefined;
      let dupDivId: string | undefined;
      if (p.kind === "trade") {
        const hit = trades.find((t) => t.accountId === target && t.date === p.date && t.symbol === p.symbol && Math.abs(t.shares - (p.shares ?? 0)) < 1e-6);
        if (hit) { dup = `trade ${p.symbol} ×${p.shares} on ${p.date}`; dupTradeId = hit.id; }
      } else if (p.kind === "dividend") {
        const hit = dividends.find((d) => (d.accountId || target) === target && d.date === p.date && d.symbol === p.symbol && Math.abs(d.amount - Math.abs(p.amount)) < 0.005);
        if (hit) { dup = `dividend ${p.symbol} on ${p.date}`; dupDivId = hit.id; }
      } else {
        const hit = transactions.find((t) => t.accountId === target && t.date === p.date && Math.abs(t.amount - p.amount) < 0.005 && (norm(t.merchant).includes(norm(p.merchant).slice(0, 20)) || norm(p.merchant).includes(norm(t.merchant).slice(0, 20))));
        if (hit) { dup = `${p.currency} ${p.amount} on ${p.date}`; dupTxnId = hit.id; }
      }
      if (!dup) return { ...p, dup: undefined, dupTradeId: undefined, dupTxnId: undefined, dupDivId: undefined };
      // keep the previously chosen action if the user already decided
      return p.dup === dup && p.action !== "add" ? { ...p, dupTradeId, dupTxnId, dupDivId } : { ...p, dup, dupTradeId, dupTxnId, dupDivId, action: "add" };
    });
  }

  function runImport() {
    let target = accountId;
    if (target === "new") {
      if (!newName.trim()) return;
      target = addAccount({ name: newName.trim(), institution: institution === "generic" ? "Imported statement" : institution, type: "brokerage" as AccountType, balance: 0, balanceDate: new Date().toISOString().slice(0, 10), currency: base }).id;
    }
    if (!target) return;
    const final = target === accountId ? reviewed(parsed, target) : parsed;
    let count = 0;
    for (const p of final) {
      if (p.kind === "skip" || p.action === "skip") continue;
      if (p.kind === "trade") {
        if (p.action === "update" && p.dupTradeId) {
          updateTrade(p.dupTradeId, { date: p.date, symbol: p.symbol!, side: p.side!, shares: p.shares!, price: p.price!, fees: p.fees ?? 0, currency: p.currency, name: p.name });
        } else {
          recordTrade({ date: p.date, symbol: p.symbol!, name: p.name || p.symbol, side: p.side!, shares: p.shares!, price: p.price!, fees: p.fees ?? 0, tax: 0, accountId: target, currency: p.currency, assetClass: "stock" as AssetClass });
        }
      } else if (p.kind === "dividend") {
        if (p.action === "update" && p.dupDivId) {
          updateDividend(p.dupDivId, { date: p.date, symbol: p.symbol!, amount: Math.abs(p.amount), currency: p.currency });
        } else {
          addDividend({ date: p.date, symbol: p.symbol!, amount: Math.abs(p.amount), accountId: target, currency: p.currency, tax: 0 });
        }
      } else {
        if (p.action === "update" && p.dupTxnId) {
          const existing = transactions.find((t) => t.id === p.dupTxnId);
          if (existing) {
            const { id: _drop, tradeId: _t, dividendId: _d, ...rest } = existing;
            addTransaction({ ...rest, date: p.date, amount: p.amount, merchant: p.merchant || existing.merchant, currency: p.currency });
          }
        } else {
          addTransaction({ date: p.date, accountId: target, amount: p.amount, currency: p.currency, kind: p.amount >= 0 ? "income" : "expense", category: p.category || "Imported", merchant: p.merchant || "Imported transaction" });
        }
      }
      count++;
    }
    toast.success(`Imported ${count} entries`);
    setParsed([]); setOpen(false);
  }

  const dupCount = parsed.filter((p) => p.dup).length;

  return <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setParsed([]); }}>
    <DialogTrigger asChild>{trigger ?? <Button variant="outline"><Upload />Import statement</Button>}</DialogTrigger>
    <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Import account statement</DialogTitle>
        <DialogDescription>Choose the institution so the right rules are applied (e.g. Superhero settlements are ignored and dividends are matched to tickers). Nothing is replaced — new entries are added alongside your ledger.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Institution</Label>
            <Select value={institution} onValueChange={(v) => { setInstitution(v); setParsed([]); }}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="superhero">Superhero</SelectItem>
                <SelectItem value="nab">NAB</SelectItem>
                <SelectItem value="generic">Generic (auto)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Statement file</Label><Input type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => void read(e.target.files?.[0])} className="mt-1.5" /></div>
        </div>
        {busy && <div className="text-sm text-muted-foreground">Resolving asset names and tickers…</div>}
        {parsed.length > 0 && <>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <strong>{importable.length}</strong> importable rows{refs.length ? ` (${refs.slice(0, 4).join(", ")})` : ""}, {parsed.filter((p) => p.kind === "skip").length} ignored{dupCount > 0 ? `, ${dupCount} possible duplicates` : ""}. The destination account applies to this import.
          </div>
          <div><Label>Destination account</Label><Select value={accountId} onValueChange={(v) => { setAccountId(v); if (v !== "new") setParsed((prev) => reviewed(prev, v)); }}><SelectTrigger className="mt-1.5"><SelectValue placeholder="Link or create account" /></SelectTrigger><SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}<SelectItem value="new">Create new account…</SelectItem></SelectContent></Select></div>
          {accountId === "new" && <div><Label>New account name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={refs[0] || "Imported brokerage"} className="mt-1.5" /></div>}
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="p-2 font-medium">Date</th><th className="p-2 font-medium">Type</th><th className="p-2 font-medium">Details</th><th className="p-2 font-medium text-right">Amount</th><th className="p-2 font-medium">Action</th></tr></thead>
              <tbody>
                {parsed.map((p) => (
                  <tr key={p.key} className={`border-b last:border-0 ${p.kind === "skip" ? "opacity-50" : ""}`}>
                    <td className="p-2 whitespace-nowrap">{p.date}</td>
                    <td className="p-2 whitespace-nowrap">{kindLabel(p.kind)}</td>
                    <td className="p-2">
                      {p.kind === "trade" && <span>{p.side?.toUpperCase()} {p.shares} {p.symbol} @ {p.price}{p.fees ? ` (fees ${p.fees})` : ""}</span>}
                      {p.kind === "dividend" && <span>Dividend — {p.name}{p.symbol ? ` (${p.symbol})` : ""}</span>}
                      {p.kind === "transaction" && <span className="truncate max-w-[220px] inline-block align-bottom">{p.merchant || p.category}</span>}
                      {p.kind === "skip" && <span>{p.reason}</span>}
                      {p.dup && <div className="text-xs text-warning">Possible duplicate: {p.dup}</div>}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">{p.amount < 0 ? "−" : ""}{p.currency} {Math.abs(p.amount).toFixed(2)}</td>
                    <td className="p-2">
                      {p.kind === "skip" ? <span className="text-xs text-muted-foreground">Excluded</span> :
                        p.dup ? (
                          <Select value={p.action} onValueChange={(v) => setParsed((prev) => prev.map((q) => q.key === p.key ? { ...q, action: v as Parsed["action"] } : q))}>
                            <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="add">Keep both</SelectItem>
                              <SelectItem value="update">Update existing</SelectItem>
                              <SelectItem value="skip">Keep old (skip)</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : <span className="text-xs text-muted-foreground">Add</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button disabled={!parsed.length || !accountId || (accountId === "new" && !newName.trim()) || busy} onClick={runImport}>Import entries</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
