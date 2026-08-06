import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Pencil, Trash2 } from "lucide-react";
import { useFinance } from "@/lib/finance/store";
import { accountBalanceAt, fmtCurrency, type Transaction } from "@/lib/finance/data";

/** Detail view for one account: balance history built from the user's own ledger, plus editable transactions. */
export function AccountDialog({ accountId, open, onOpenChange }: { accountId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const accounts = useFinance((s) => s.accounts);
  const transactions = useFinance((s) => s.transactions);
  const updateTransaction = useFinance((s) => s.updateTransaction);
  const deleteTransaction = useFinance((s) => s.deleteTransaction);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [editing, setEditing] = useState<Transaction | null>(null);

  const account = accounts.find((a) => a.id === accountId) ?? null;

  const ledger = useMemo(
    () => transactions.filter((t) => t.accountId === accountId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions, accountId],
  );

  const series = useMemo(() => {
    if (!account) return [];
    const dates = Array.from(new Set(ledger.map((t) => t.date))).sort();
    const today = new Date().toISOString().slice(0, 10);
    if (!dates.includes(today)) dates.push(today);
    return dates.map((date) => ({ date, balance: Math.round(accountBalanceAt(account, transactions, date) * 100) / 100 }));
  }, [account, ledger, transactions]);

  const filtered = ledger
    .filter((t) => kind === "all" || t.kind === kind)
    .filter((t) => !query || `${t.date} ${t.merchant} ${t.category} ${t.notes ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  if (!account) return null;
  const today = new Date().toISOString().slice(0, 10);
  const balance = accountBalanceAt(account, transactions, today);
  const inflow = ledger.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflow = ledger.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{account.name}</DialogTitle>
            <DialogDescription>{account.institution || "No institution"} · {account.type} · {account.currency}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-4 text-sm">
            <span>Balance <strong className="num">{fmtCurrency(balance, { currency: account.currency })}</strong></span>
            <span>In <strong className="num text-success">{fmtCurrency(inflow, { currency: account.currency })}</strong></span>
            <span>Out <strong className="num">{fmtCurrency(outflow, { currency: account.currency })}</strong></span>
            <span>Entries <strong className="num">{ledger.length}</strong></span>
          </div>

          <div className="h-64">
            {series.length > 1 ? (
              <ResponsiveContainer>
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="acctFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, { currency: account.currency, compact: true })} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                    formatter={(v: number) => fmtCurrency(v, { currency: account.currency })}
                  />
                  <Area type="monotone" dataKey="balance" stroke="var(--chart-1)" fill="url(#acctFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                Log transactions on this account to build its balance history.
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
                <TableHead>Merchant</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} className="group">
                  <TableCell className="num text-muted-foreground whitespace-nowrap">{t.date}</TableCell>
                  <TableCell>
                    <div className="font-medium">{t.merchant}</div>
                    {t.notes && <div className="text-xs text-muted-foreground">{t.notes}</div>}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{t.category}</Badge></TableCell>
                  <TableCell className={"text-right num font-medium " + (t.amount > 0 ? "text-success" : "")}>
                    {fmtCurrency(t.amount, { currency: t.currency ?? account.currency })}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <button aria-label="Edit transaction" onClick={() => setEditing(t)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground mr-2">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button aria-label="Delete transaction" onClick={() => deleteTransaction(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">No transactions on this account yet.</TableCell></TableRow>
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
          <div><Label>Merchant</Label><Input className="mt-1.5" value={merchant} onChange={(e) => setMerchant(e.target.value)} /></div>
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
