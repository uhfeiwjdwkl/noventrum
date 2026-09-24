import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Area, ComposedChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinance } from "@/lib/finance/store";
import { accountBalanceAt, fmtCurrency, type Trade, type Transaction } from "@/lib/finance/data";
import { getHistory } from "@/lib/prices.functions";
import { BuySellDialog } from "@/components/finance/ExtraDialogs";

const PERIODS = [
  { key: "1M", days: 30 },
  { key: "3M", days: 91 },
  { key: "6M", days: 182 },
  { key: "1Y", days: 365 },
  { key: "5Y", days: 1826 },
  { key: "MAX", days: Infinity },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000));
type Series = { date: string; close: number }[];

/** Latest close at/before a date (series sorted ascending). */
function closeAt(s: Series | undefined, date: string): number | undefined {
  if (!s || s.length === 0) return undefined;
  let lo = 0, hi = s.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (s[mid].date <= date) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans >= 0 ? s[ans].close : s[0].close;
}

function rangeFor(from: string) {
  const days = Math.ceil((Date.now() - new Date(from).getTime()) / 86_400_000) + 10;
  if (days > 1825) return { range: days > 3650 ? "max" : "10y", interval: "1wk" };
  if (days > 365) return { range: "5y", interval: "1wk" };
  return { range: days > 90 ? "1y" : "3mo", interval: "1d" };
}

/**
 * Account detail: value history = cash (from ledger, around the confirmed anchor)
 * + holdings settled through this account valued at historical closes.
 * Backdated trades therefore carry all growth since their date.
 */
export function AccountDialog({ accountId, open, onOpenChange }: { accountId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const accounts = useFinance((s) => s.accounts);
  const transactions = useFinance((s) => s.transactions);
  const trades = useFinance((s) => s.trades);
  const updateTransaction = useFinance((s) => s.updateTransaction);
  const deleteTransaction = useFinance((s) => s.deleteTransaction);
  const deleteTrade = useFinance((s) => s.deleteTrade);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("1Y");
  const [selection, setSelection] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, Series>>({});
  const [loading, setLoading] = useState(false);

  const account = accounts.find((a) => a.id === accountId) ?? null;
  const today = iso(new Date());

  const ledger = useMemo(
    () => transactions.filter((t) => t.accountId === accountId).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [transactions, accountId],
  );
  const acctTrades = useMemo(
    () => trades.filter((t) => t.accountId === accountId && t.assetClass !== "forex" && !t.exchange),
    [trades, accountId],
  );

  // Fetch (not store) price history for every asset settled through this account, plus FX into the account currency.
  const symbolKey = useMemo(() => {
    const syms = new Map<string, { from: string; currency?: string }>();
    for (const t of acctTrades) {
      const s = t.symbol.toUpperCase();
      const cur = syms.get(s);
      if (!cur || t.date < cur.from) syms.set(s, { from: t.date, currency: t.currency });
    }
    return JSON.stringify([...syms.entries()].sort());
  }, [acctTrades]);

  useEffect(() => {
    if (!account || !open) return;
    const entries = JSON.parse(symbolKey) as [string, { from: string; currency?: string }][];
    if (entries.length === 0) return;
    let cancelled = false;
    setLoading(true);
    const jobs: Promise<void>[] = [];
    const next: Record<string, Series> = {};
    for (const [sym, { from, currency }] of entries) {
      const r = rangeFor(from);
      jobs.push(
        getHistory({ data: { symbol: sym, ...r } })
          .then((h) => { next[sym] = h.points; if (h.currency && h.currency !== account.currency) return getHistory({ data: { symbol: `${h.currency}${account.currency}=X`, ...r } }).then((f) => { next[`fx:${sym}`] = f.points; }); })
          .catch(() => {}),
      );
      void currency;
    }
    Promise.all(jobs).then(() => { if (!cancelled) { setPrices(next); setLoading(false); } });
    return () => { cancelled = true; };
  }, [symbolKey, account?.currency, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const valueAt = useMemo(() => {
    if (!account) return () => 0;
    return (date: string) => {
      let v = accountBalanceAt(account, transactions, date);
      const shares = new Map<string, { q: number; lastPrice: number; cur?: string }>();
      for (const t of acctTrades) {
        if (t.date > date) continue;
        const s = t.symbol.toUpperCase();
        const cur = shares.get(s) ?? { q: 0, lastPrice: t.price, cur: t.currency };
        cur.q += t.side === "buy" ? t.shares : -t.shares;
        cur.lastPrice = t.price;
        shares.set(s, cur);
      }
      for (const [s, { q, lastPrice, cur }] of shares) {
        if (q <= 1e-9) continue;
        const px = closeAt(prices[s], date) ?? lastPrice;
        const fx = cur && cur !== account.currency ? closeAt(prices[`fx:${s}`], date) ?? 1 : 1;
        v += q * px * fx;
      }
      return v;
    };
  }, [account, transactions, acctTrades, prices]);

  const firstDate = useMemo(() => {
    const ds = [...ledger.map((t) => t.date), ...acctTrades.map((t) => t.date)].sort();
    return ds[0] ?? today;
  }, [ledger, acctTrades, today]);

  const series = useMemo(() => {
    if (!account) return [];
    const p = PERIODS.find((x) => x.key === period)!;
    const start = p.days === Infinity ? firstDate : daysAgo(p.days);
    const from = start < firstDate ? firstDate : start;
    const dates = new Set<string>([from, today]);
    const spanDays = Math.max(1, (Date.now() - new Date(from).getTime()) / 86_400_000);
    const step = spanDays > 730 ? 7 : 1;
    for (let d = new Date(from); iso(d) <= today; d = new Date(d.getTime() + step * 86_400_000)) dates.add(iso(d));
    for (const t of ledger) if (t.date >= from && t.date <= today) dates.add(t.date);
    return [...dates].sort().map((date) => ({ date, value: Math.round(valueAt(date) * 100) / 100 }));
  }, [account, period, firstDate, today, ledger, valueAt]);

  /** Return over a window, net of deposits/withdrawals (non-trade cash flows). */
  function returnBetween(a: string, b: string) {
    const start = valueAt(a);
    const end = valueAt(b);
    const flows = ledger.filter((t) => !t.tradeId && t.date > a && t.date <= b).reduce((s, t) => s + t.amount, 0);
    const gain = end - start - flows;
    const denom = start > 0 ? start : Math.max(1, flows);
    return { start, end, gain, pct: (gain / denom) * 100 };
  }

  const periodReturns = useMemo(
    () => PERIODS.map((p) => {
      const a = p.days === Infinity ? firstDate : daysAgo(p.days);
      return { key: p.key, ...returnBetween(a < firstDate ? firstDate : a, today) };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valueAt, firstDate, today, ledger],
  );

  const comparison = useMemo(() => {
    if (selection.length !== 2) return null;
    const [a, b] = [...selection].sort();
    return { a, b, ...returnBetween(a, b) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, valueAt]);

  const filtered = ledger
    .filter((t) => kind === "all" || t.kind === kind)
    .filter((t) => !query || `${t.date} ${t.merchant} ${t.category} ${t.notes ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  if (!account) return null;
  const cash = accountBalanceAt(account, transactions, today);
  const total = valueAt(today);
  const cur = account.currency;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{account.name}</DialogTitle>
            <DialogDescription>{account.institution || "No institution"} · {account.type} · {cur}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-4 text-sm">
            <span>Total value <strong className="num">{fmtCurrency(total, { currency: cur })}</strong></span>
            {acctTrades.length > 0 && <span>Cash <strong className="num">{fmtCurrency(cash, { currency: cur })}</strong></span>}
            {acctTrades.length > 0 && <span>Investments <strong className="num">{fmtCurrency(total - cash, { currency: cur })}</strong></span>}
            <span>Entries <strong className="num">{ledger.length}</strong></span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {periodReturns.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => { setPeriod(r.key); setSelection([]); }}
                className={cn("rounded-md border px-2 py-1.5 text-left transition", r.key === period ? "border-primary bg-primary/10" : "border-border hover:bg-accent")}
              >
                <div className="text-[11px] text-muted-foreground">{r.key}</div>
                <div className={cn("text-xs font-semibold num", r.gain >= 0 ? "text-success" : "text-destructive")}>
                  {r.pct >= 0 ? "+" : ""}{r.pct.toFixed(2)}%
                </div>
                <div className="text-[11px] num text-muted-foreground">{fmtCurrency(r.gain, { currency: cur, compact: true })}</div>
              </button>
            ))}
          </div>

          {comparison ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border bg-muted/40 px-3 py-2 text-xs">
              <span>{comparison.a} → {comparison.b}</span>
              <span className={comparison.gain >= 0 ? "text-success" : "text-destructive"}>
                {fmtCurrency(comparison.gain, { currency: cur })} ({comparison.pct >= 0 ? "+" : ""}{comparison.pct.toFixed(2)}%)
              </span>
              <span className="text-muted-foreground">excl. deposits/withdrawals</span>
              <Button variant="ghost" size="sm" onClick={() => setSelection([])}>Clear</Button>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Click two points on the chart to compare growth between them.</div>
          )}

          <div className="h-64 relative">
            {loading && (
              <div className="absolute inset-0 grid place-items-center bg-background/60 z-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {series.length > 1 ? (
              <ResponsiveContainer>
                <ComposedChart
                  data={series}
                  className="cursor-crosshair"
                  onClick={(state) => {
                    const date = typeof state?.activeLabel === "string" ? state.activeLabel : undefined;
                    if (!date) return;
                    setSelection((c) => (c.length === 1 ? [c[0], date] : [date]));
                  }}
                >
                  <defs>
                    <linearGradient id="acctFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" minTickGap={32} />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" domain={["auto", "auto"]} tickFormatter={(v: number) => fmtCurrency(v, { currency: cur, compact: true })} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                    formatter={(v: number) => fmtCurrency(v, { currency: cur })}
                  />
                  <Area type="monotone" dataKey="value" name="Value" stroke="var(--chart-1)" fill="url(#acctFill)" strokeWidth={2} />
                  {selection.length === 2 && <ReferenceArea x1={selection[0]} x2={selection[1]} fill="var(--chart-2)" fillOpacity={0.12} />}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                Log transactions on this account to build its history.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this account…" className="max-w-sm" />
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="trade">Trade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Cash balance</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const trade = t.tradeId ? trades.find((x) => x.id === t.tradeId) : undefined;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="num text-muted-foreground whitespace-nowrap">{t.date}</TableCell>
                    <TableCell>
                      <div className="font-medium">{t.merchant}</div>
                      {t.notes && <div className="text-xs text-muted-foreground">{t.notes}</div>}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{t.category}</Badge></TableCell>
                    <TableCell className={"text-right num font-medium " + (t.amount > 0 ? "text-success" : "")}>
                      {fmtCurrency(t.amount, { currency: t.currency ?? cur })}
                    </TableCell>
                    <TableCell className="text-right num text-muted-foreground">
                      {fmtCurrency(accountBalanceAt(account, transactions, t.date), { currency: cur })}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <button aria-label="Edit" onClick={() => (trade ? setEditingTrade(trade) : setEditing(t))} className="text-muted-foreground hover:text-foreground mr-2">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button aria-label="Delete" onClick={() => (trade ? deleteTrade(trade.id) : deleteTransaction(t.id))} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No transactions on this account yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {editing && (
        <EditTransactionDialog
          transaction={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            updateTransaction(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
      {editingTrade && (
        <BuySellDialog
          key={editingTrade.id}
          open
          onOpenChange={(o) => !o && setEditingTrade(null)}
          editTrade={editingTrade}
        />
      )}
    </>
  );
}

function EditTransactionDialog({
  transaction,
  onClose,
  onSave,
}: {
  transaction: Transaction;
  onClose: () => void;
  onSave: (patch: Partial<Omit<Transaction, "id">>) => void;
}) {
  const [date, setDate] = useState(transaction.date);
  const [merchant, setMerchant] = useState(transaction.merchant);
  const [category, setCategory] = useState(transaction.category);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [notes, setNotes] = useState(transaction.notes ?? "");

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit transaction</DialogTitle>
          <DialogDescription>Changes re-derive balances from the ledger.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input className="mt-1.5" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>Amount</Label><Input className="mt-1.5" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          </div>
          <div><Label>Description</Label><Input className="mt-1.5" value={merchant} onChange={(e) => setMerchant(e.target.value)} /></div>
          <div><Label>Category</Label><Input className="mt-1.5" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
          <div><Label>Notes</Label><Input className="mt-1.5" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ date, merchant, category, amount: Number(amount) || 0, notes: notes || undefined })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
