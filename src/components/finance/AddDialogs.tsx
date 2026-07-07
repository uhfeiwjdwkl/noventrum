import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Wallet,
  Receipt,
  TrendingUp,
  PiggyBank,
  Target,
} from "lucide-react";
import { useFinance } from "@/lib/finance/store";
import type { AccountType, TxnKind } from "@/lib/finance/data";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------- Account ------------------------------- */

export function AddAccountDialog({
  trigger,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const addAccount = useFinance((s) => s.addAccount);
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState("USD");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const bal = Number(balance) || 0;
    // For liabilities, coerce to negative
    const signed = type === "credit" || type === "loan" || type === "mortgage" ? -Math.abs(bal) : bal;
    addAccount({ name: name.trim(), institution: institution.trim(), type, balance: signed, currency });
    toast.success("Account added");
    setName(""); setInstitution(""); setBalance(""); setType("checking");
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add account</DialogTitle>
          <DialogDescription>Track any bank, card, brokerage or loan account.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div><Label>Account name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Everyday Checking" required autoFocus /></div>
          <div><Label>Institution</Label><Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Chase" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="credit">Credit card</SelectItem>
                  <SelectItem value="brokerage">Brokerage</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="loan">Loan</SelectItem>
                  <SelectItem value="mortgage">Mortgage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Current balance</Label><Input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Add account</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- Transaction ----------------------------- */

export function AddTransactionDialog({
  trigger,
  open,
  onOpenChange,
  defaultKind,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  defaultKind?: TxnKind;
}) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const accounts = useFinance((s) => s.accounts);
  const addTransaction = useFinance((s) => s.addTransaction);

  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<TxnKind>(defaultKind ?? "expense");
  const [accountId, setAccountId] = useState<string>("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [recurring, setRecurring] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!merchant.trim() || !amount) return;
    if (accounts.length && !accountId) {
      toast.error("Choose an account");
      return;
    }
    const raw = Math.abs(Number(amount) || 0);
    const signed = kind === "income" ? raw : -raw;
    addTransaction({
      date,
      accountId: accountId || (accounts[0]?.id ?? ""),
      amount: signed,
      kind,
      category: category.trim() || (kind === "income" ? "Other income" : "Uncategorized"),
      merchant: merchant.trim(),
      notes: notes.trim() || undefined,
      recurring,
    });
    toast.success("Transaction added");
    setMerchant(""); setCategory(""); setAmount(""); setNotes(""); setRecurring(false);
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add transaction</DialogTitle>
          <DialogDescription>Log income, an expense or a transfer.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as TxnKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Merchant / Payer</Label><Input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Whole Foods" required autoFocus /></div>
            <div><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Groceries" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div>
              <Label>Account</Label>
              {accounts.length === 0 ? (
                <div className="text-xs text-muted-foreground mt-2">Add an account first.</div>
              ) : (
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /> Recurring transaction</label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={accounts.length === 0}>Add transaction</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- Holding ------------------------------- */

export function AddHoldingDialog({
  trigger,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const addHolding = useFinance((s) => s.addHolding);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState<"stock" | "etf" | "commodity" | "cash" | "crypto" | "other">("stock");
  const [shares, setShares] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [price, setPrice] = useState("");
  const [sector, setSector] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol.trim() || !shares || !price) return;
    addHolding({
      symbol: symbol.trim().toUpperCase(),
      name: name.trim() || symbol.trim().toUpperCase(),
      assetClass,
      shares: Number(shares),
      avgCost: Number(avgCost) || Number(price),
      price: Number(price),
      dayChangePct: 0,
      sector: sector.trim() || undefined,
    });
    toast.success("Holding added");
    setSymbol(""); setName(""); setShares(""); setAvgCost(""); setPrice(""); setSector("");
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add holding</DialogTitle>
          <DialogDescription>Track a stock, ETF, crypto or other position.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Symbol</Label><Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="AAPL" required autoFocus /></div>
            <div>
              <Label>Asset class</Label>
              <Select value={assetClass} onValueChange={(v) => setAssetClass(v as typeof assetClass)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="etf">ETF</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="commodity">Commodity</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apple Inc." /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Shares</Label><Input type="number" step="0.0001" value={shares} onChange={(e) => setShares(e.target.value)} required /></div>
            <div><Label>Avg cost</Label><Input type="number" step="0.01" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} /></div>
            <div><Label>Current price</Label><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
          </div>
          <div><Label>Sector</Label><Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Technology" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Add holding</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Budget ------------------------------- */

export function AddBudgetDialog({
  trigger,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const addBudget = useFinance((s) => s.addBudget);
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!category.trim() || !limit) return;
    addBudget({ category: category.trim(), limit: Number(limit) });
    toast.success("Budget added");
    setCategory(""); setLimit("");
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add budget</DialogTitle>
          <DialogDescription>Set a monthly spending limit for a category.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Groceries" required autoFocus /></div>
          <div><Label>Monthly limit</Label><Input type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="500.00" required /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Add budget</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- Goal -------------------------------- */

export function AddGoalDialog({
  trigger,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const addGoal = useFinance((s) => s.addGoal);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [monthlyContribution, setMonthly] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !target) return;
    addGoal({
      name: name.trim(),
      target: Number(target),
      current: Number(current) || 0,
      deadline,
      monthlyContribution: Number(monthlyContribution) || 0,
    });
    toast.success("Goal added");
    setName(""); setTarget(""); setCurrent(""); setMonthly("");
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add goal</DialogTitle>
          <DialogDescription>Save toward something meaningful.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div><Label>Goal name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Emergency fund" required autoFocus /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Target amount</Label><Input type="number" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} required /></div>
            <div><Label>Already saved</Label><Input type="number" step="0.01" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="0" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Deadline</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required /></div>
            <div><Label>Monthly contribution</Label><Input type="number" step="0.01" value={monthlyContribution} onChange={(e) => setMonthly(e.target.value)} placeholder="0" /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Add goal</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- AddMenu ------------------------------- */

type MenuKind = "account" | "transaction" | "holding" | "budget" | "goal";

export function AddMenu() {
  const [open, setOpen] = useState<MenuKind | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Add</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Add new</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen("transaction")}><Receipt className="h-4 w-4 mr-2" />Transaction</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("account")}><Wallet className="h-4 w-4 mr-2" />Account</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("holding")}><TrendingUp className="h-4 w-4 mr-2" />Holding</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("budget")}><PiggyBank className="h-4 w-4 mr-2" />Budget</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("goal")}><Target className="h-4 w-4 mr-2" />Goal</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AddAccountDialog open={open === "account"} onOpenChange={(o) => setOpen(o ? "account" : null)} />
      <AddTransactionDialog open={open === "transaction"} onOpenChange={(o) => setOpen(o ? "transaction" : null)} />
      <AddHoldingDialog open={open === "holding"} onOpenChange={(o) => setOpen(o ? "holding" : null)} />
      <AddBudgetDialog open={open === "budget"} onOpenChange={(o) => setOpen(o ? "budget" : null)} />
      <AddGoalDialog open={open === "goal"} onOpenChange={(o) => setOpen(o ? "goal" : null)} />
    </>
  );
}
