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
import { RefreshCw } from "lucide-react";
import { useFinance } from "@/lib/finance/store";
import type { AssetClass } from "@/lib/finance/data";
import { getQuote } from "@/lib/prices.functions";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "BRL"];

/* ------------------------------- Buy / Sell -------------------------------- */

export function BuySellDialog({
  trigger,
  open,
  onOpenChange,
  defaultSide,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  defaultSide?: "buy" | "sell";
}) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const accounts = useFinance((s) => s.accounts);
  const recordTrade = useFinance((s) => s.recordTrade);
  const refreshHistory = useFinance((s) => s.refreshHistory);

  const brokerage = accounts.filter((a) => a.type === "brokerage" || a.type === "cash");

  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("stock");
  const [side, setSide] = useState<"buy" | "sell">(defaultSide ?? "buy");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("");
  const [tax, setTax] = useState("");
  const [date, setDate] = useState(today());
  const [accountId, setAccountId] = useState<string>("");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);

  async function lookup() {
    if (!symbol.trim()) return;
    setLoading(true);
    try {
      const q = await getQuote({ data: { symbol: symbol.trim().toUpperCase() } });
      setName(q.name);
      setPrice(String(q.price.toFixed(2)));
      setCurrency(q.currency);
      toast.success(`Fetched ${q.symbol} @ ${q.price.toFixed(2)} ${q.currency}`);
    } catch (e: unknown) {
      toast.error("Live quote failed", { description: e instanceof Error ? e.message : "unknown" });
    } finally {
      setLoading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol.trim() || !shares || !price) return;
    if (!accountId) {
      toast.error("Choose the settlement account");
      return;
    }
    const sym = symbol.trim().toUpperCase();
    recordTrade({
      date,
      symbol: sym,
      name: name || sym,
      assetClass,
      side,
      shares: Number(shares),
      price: Number(price),
      fees: Number(fees) || 0,
      tax: Number(tax) || 0,
      accountId,
      currency,
    });
    // fetch a history line for back-calculated net worth
    void refreshHistory(sym);
    toast.success(`${side === "buy" ? "Bought" : "Sold"} ${shares} ${sym}`);
    setSymbol(""); setName(""); setShares(""); setPrice(""); setFees(""); setTax("");
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Buy or sell an asset</DialogTitle>
          <DialogDescription>Stocks, ETFs, crypto and commodities. Fees and tax are folded into your cost basis.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <Label>Symbol / Ticker</Label>
              <div className="flex gap-2 mt-1.5">
                <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL, BTC-USD, VUSA.L" required autoFocus />
                <Button type="button" variant="outline" size="icon" onClick={lookup} disabled={loading} title="Fetch live quote">
                  <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
                </Button>
              </div>
            </div>
            <div>
              <Label>Side</Label>
              <Select value={side} onValueChange={(v) => setSide(v as "buy" | "sell")}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Class</Label>
              <Select value={assetClass} onValueChange={(v) => setAssetClass(v as AssetClass)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="etf">ETF</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="commodity">Commodity</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apple Inc." className="mt-1.5" /></div>
          <div className="grid grid-cols-4 gap-3">
            <div><Label>Quantity</Label><Input className="mt-1.5" type="number" step="0.0001" value={shares} onChange={(e) => setShares(e.target.value)} required /></div>
            <div><Label>Price</Label><Input className="mt-1.5" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
            <div><Label>Fees</Label><Input className="mt-1.5" type="number" step="0.01" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0.00" /></div>
            <div><Label>Tax</Label><Input className="mt-1.5" type="number" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0.00" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Date</Label><Input className="mt-1.5" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Settle from</Label>
              {brokerage.length === 0 ? (
                <div className="text-xs text-muted-foreground mt-2">Add a brokerage/cash account first.</div>
              ) : (
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>{brokerage.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={brokerage.length === 0}>{side === "buy" ? "Record buy" : "Record sell"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- Property --------------------------------- */

export function AddPropertyDialog({
  trigger, open, onOpenChange,
}: { trigger?: ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const addProperty = useFinance((s) => s.addProperty);
  const accounts = useFinance((s) => s.accounts);
  const mortgages = accounts.filter((a) => a.type === "mortgage");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [purchasePrice, setPurchasePrice] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [fees, setFees] = useState("");
  const [tax, setTax] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [linkedMortgageAccountId, setLinked] = useState<string>("");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !purchasePrice) return;
    addProperty({
      name: name.trim(),
      address: address.trim() || undefined,
      purchaseDate,
      purchasePrice: Number(purchasePrice),
      currentValue: Number(currentValue) || Number(purchasePrice),
      fees: Number(fees) || 0,
      tax: Number(tax) || 0,
      currency,
      linkedMortgageAccountId: linkedMortgageAccountId || undefined,
      notes: notes.trim() || undefined,
    });
    toast.success("Property added");
    setName(""); setAddress(""); setPurchasePrice(""); setCurrentValue(""); setFees(""); setTax(""); setNotes(""); setLinked("");
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add property</DialogTitle>
          <DialogDescription>Real estate you own. Fees and stamp duty are captured for accurate cost basis.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nickname</Label><Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="Home" required autoFocus /></div>
            <div><Label>Address</Label><Input className="mt-1.5" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><Label>Purchase date</Label><Input className="mt-1.5" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required /></div>
            <div><Label>Purchase price</Label><Input className="mt-1.5" type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} required /></div>
            <div><Label>Fees</Label><Input className="mt-1.5" type="number" step="0.01" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="Legal, agent" /></div>
            <div><Label>Tax / Duty</Label><Input className="mt-1.5" type="number" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="Stamp duty" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Current value</Label><Input className="mt-1.5" type="number" step="0.01" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} placeholder="Defaults to purchase price" /></div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
            <div>
              <Label>Link mortgage</Label>
              {mortgages.length === 0 ? (
                <div className="text-xs text-muted-foreground mt-2">No mortgage account — add one from Accounts.</div>
              ) : (
                <Select value={linkedMortgageAccountId} onValueChange={setLinked}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>{mortgages.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Add property</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- Physical asset ---------------------------- */

export function AddPhysicalDialog({
  trigger, open, onOpenChange,
}: { trigger?: ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const add = useFinance((s) => s.addPhysicalAsset);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Vehicle");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [purchasePrice, setPurchasePrice] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [fees, setFees] = useState("");
  const [tax, setTax] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !purchasePrice) return;
    add({
      name: name.trim(), category, purchaseDate,
      purchasePrice: Number(purchasePrice),
      currentValue: Number(currentValue) || Number(purchasePrice),
      fees: Number(fees) || 0, tax: Number(tax) || 0, currency,
      notes: notes.trim() || undefined,
    });
    toast.success("Asset added");
    setName(""); setPurchasePrice(""); setCurrentValue(""); setFees(""); setTax(""); setNotes("");
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add physical asset</DialogTitle>
          <DialogDescription>Vehicles, jewelry, art, collectibles — anything owned outright.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="2019 Honda Civic" required autoFocus /></div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vehicle">Vehicle</SelectItem>
                  <SelectItem value="Jewelry">Jewelry</SelectItem>
                  <SelectItem value="Art">Art</SelectItem>
                  <SelectItem value="Collectible">Collectible</SelectItem>
                  <SelectItem value="Electronics">Electronics</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><Label>Date</Label><Input className="mt-1.5" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required /></div>
            <div><Label>Purchase price</Label><Input className="mt-1.5" type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} required /></div>
            <div><Label>Fees</Label><Input className="mt-1.5" type="number" step="0.01" value={fees} onChange={(e) => setFees(e.target.value)} /></div>
            <div><Label>Tax</Label><Input className="mt-1.5" type="number" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Current value</Label><Input className="mt-1.5" type="number" step="0.01" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} /></div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Add asset</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Dividend -------------------------------- */

export function AddDividendDialog({
  trigger, open, onOpenChange,
}: { trigger?: ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const addDividend = useFinance((s) => s.addDividend);
  const holdings = useFinance((s) => s.holdings);
  const accounts = useFinance((s) => s.accounts);
  const brokerage = accounts.filter((a) => a.type === "brokerage" || a.type === "cash");

  const [date, setDate] = useState(today());
  const [symbol, setSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [tax, setTax] = useState("");
  const [accountId, setAccountId] = useState("");
  const [currency, setCurrency] = useState("USD");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol.trim() || !amount) return;
    addDividend({
      date, symbol: symbol.trim().toUpperCase(),
      amount: Number(amount), tax: Number(tax) || 0,
      accountId: accountId || undefined, currency,
    });
    toast.success("Dividend logged");
    setSymbol(""); setAmount(""); setTax("");
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log dividend</DialogTitle>
          <DialogDescription>Cash dividends. Post to a brokerage account and net of withholding tax.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Date</Label><Input className="mt-1.5" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div>
              <Label>Symbol</Label>
              {holdings.length ? (
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Pick" /></SelectTrigger>
                  <SelectContent>{holdings.map((h) => <SelectItem key={h.id} value={h.symbol}>{h.symbol}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input className="mt-1.5" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" required />
              )}
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Gross amount</Label><Input className="mt-1.5" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
            <div><Label>Tax withheld</Label><Input className="mt-1.5" type="number" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} /></div>
            <div>
              <Label>Deposit into</Label>
              {brokerage.length === 0 ? (
                <div className="text-xs text-muted-foreground mt-2">None linked</div>
              ) : (
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{brokerage.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Log dividend</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- Income Source ---------------------------- */

export function AddIncomeSourceDialog({
  trigger, open, onOpenChange,
}: { trigger?: ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const add = useFinance((s) => s.addIncomeSource);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"salary" | "rental" | "side" | "dividend" | "interest" | "other">("salary");
  const [monthly, setMonthly] = useState("");
  const [currency, setCurrency] = useState("USD");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !monthly) return;
    add({ name: name.trim(), kind, monthly: Number(monthly), currency, active: true });
    toast.success("Income source added");
    setName(""); setMonthly("");
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add income source</DialogTitle>
          <DialogDescription>Salary, rental income, side gigs — anything that pays you regularly.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div><Label>Name</Label><Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp — Salary" required autoFocus /></div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salary">Salary</SelectItem>
                  <SelectItem value="rental">Rental</SelectItem>
                  <SelectItem value="side">Side income</SelectItem>
                  <SelectItem value="dividend">Dividends</SelectItem>
                  <SelectItem value="interest">Interest</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Monthly amount</Label><Input className="mt-1.5" type="number" step="0.01" value={monthly} onChange={(e) => setMonthly(e.target.value)} required /></div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Add source</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
