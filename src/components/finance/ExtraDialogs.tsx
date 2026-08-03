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
import { useFinance } from "@/lib/finance/store";
import type { AssetClass, Trade } from "@/lib/finance/data";
import { getQuote, getFxRateAt } from "@/lib/prices.functions";
import { SymbolSearch } from "@/components/finance/SymbolSearch";
import { CurrencyPicker } from "@/components/finance/CurrencyPicker";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);


/* ------------------------------- Buy / Sell -------------------------------- */

export function BuySellDialog({
  trigger,
  open,
  onOpenChange,
  defaultSide,
  editTrade,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  defaultSide?: "buy" | "sell";
  /** when supplied the dialog edits this logged trade instead of adding one */
  editTrade?: Trade;
}) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const accounts = useFinance((s) => s.accounts);
  const recordTrade = useFinance((s) => s.recordTrade);
  const updateTrade = useFinance((s) => s.updateTrade);
  const refreshHistory = useFinance((s) => s.refreshHistory);

  const brokerage = accounts.filter((a) => a.type === "brokerage" || a.type === "cash");

  const [symbol, setSymbol] = useState(editTrade?.symbol ?? "");
  const [name, setName] = useState(editTrade?.name ?? "");
  const [assetClass, setAssetClass] = useState<AssetClass>(editTrade?.assetClass ?? "stock");
  const [side, setSide] = useState<"buy" | "sell">(editTrade?.side ?? defaultSide ?? "buy");
  const [shares, setShares] = useState(editTrade ? String(editTrade.shares) : "");
  const [price, setPrice] = useState(editTrade ? String(editTrade.price) : "");
  const [fees, setFees] = useState(editTrade?.fees ? String(editTrade.fees) : "");
  const [tax, setTax] = useState(editTrade?.tax ? String(editTrade.tax) : "");
  const [date, setDate] = useState(editTrade?.date ?? today());
  const [accountId, setAccountId] = useState<string>(editTrade?.accountId ?? "");
  const [currency, setCurrency] = useState(editTrade?.currency ?? useFinance.getState().settings.baseCurrency);
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol.trim() || !shares || !price) return;
    if (!accountId) {
      toast.error("Choose the settlement account");
      return;
    }
    const sym = symbol.trim().toUpperCase();
    if (editTrade) {
      updateTrade(editTrade.id, {
        date, symbol: sym, name: name || sym, assetClass, side,
        shares: Number(shares), price: Number(price),
        fees: Number(fees) || 0, tax: Number(tax) || 0, accountId, currency,
      });
      toast.success("Trade updated");
      setOpen(false);
      return;
    }
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
    // cache historical closes so past net worth can be back-calculated
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
          <DialogTitle>{editTrade ? "Edit trade" : "Buy or sell an asset"}</DialogTitle>
          <DialogDescription>Search any stock, ETF, crypto or commodity — prices come from live market data. Backdate freely; holdings and past net worth are recalculated from the ledger.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <Label>Asset</Label>
              <div className="mt-1.5">
                <SymbolSearch
                  value={symbol}
                  onChange={setSymbol}
                  autoFocus
                  onSelect={async (m) => {
                    setName(m.name);
                    const t = m.type.toLowerCase();
                    setAssetClass(
                      t.includes("etf") ? "etf"
                        : t.includes("crypto") ? "crypto"
                        : t.includes("future") || t.includes("commodity") ? "commodity"
                        : t.includes("equity") || t.includes("stock") ? "stock"
                        : "other",
                    );
                    setLoading(true);
                    try {
                      const q = await getQuote({ data: { symbol: m.symbol } });
                      setPrice(q.price.toFixed(2));
                      setCurrency(q.currency);
                    } catch {
                      /* keep manual entry */
                    } finally {
                      setLoading(false);
                    }
                  }}
                />
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
              <CurrencyPicker value={currency} onChange={setCurrency} className="mt-1.5" />
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
  const [currency, setCurrency] = useState(useFinance.getState().settings.baseCurrency);
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
              <CurrencyPicker value={currency} onChange={setCurrency} className="mt-1.5" />
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
  const [currency, setCurrency] = useState(useFinance.getState().settings.baseCurrency);
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
              <CurrencyPicker value={currency} onChange={setCurrency} className="mt-1.5" />
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
  const [currency, setCurrency] = useState(useFinance.getState().settings.baseCurrency);

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
              <CurrencyPicker value={currency} onChange={setCurrency} className="mt-1.5" />
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
  const [currency, setCurrency] = useState(useFinance.getState().settings.baseCurrency);

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
              <CurrencyPicker value={currency} onChange={setCurrency} className="mt-1.5" />
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

/* ---------------------------- Currency exchange ---------------------------- */

export function ExchangeDialog({
  trigger, open, onOpenChange,
}: { trigger?: ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const accounts = useFinance((s) => s.accounts);
  const recordExchange = useFinance((s) => s.recordExchange);
  const cash = accounts.filter((a) => ["checking", "savings", "cash", "brokerage"].includes(a.type));

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [fees, setFees] = useState("");
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(false);

  const from = cash.find((a) => a.id === fromId);
  const to = cash.find((a) => a.id === toId);
  const received = (Number(amount) - (Number(fees) || 0)) * (Number(rate) || 0);

  async function fetchRate() {
    if (!from || !to) return;
    setLoading(true);
    try {
      const r = await getFxRateAt({ data: { from: from.currency ?? "AUD", to: to.currency ?? "AUD", date } });
      if (r > 0) setRate(String(Number(r.toFixed(6))));
      else toast.error("No rate found for that date");
    } catch {
      toast.error("Couldn't fetch that rate");
    } finally {
      setLoading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to || from.id === to.id) return toast.error("Pick two different accounts");
    if (!amount || !rate) return toast.error("Enter an amount and rate");
    recordExchange({
      date,
      fromAccountId: from.id,
      toAccountId: to.id,
      amount: Number(amount),
      rate: Number(rate),
      fees: Number(fees) || 0,
    });
    toast.success(`Exchanged ${from.currency} → ${to.currency}`);
    setAmount(""); setRate(""); setFees("");
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exchange currency</DialogTitle>
          <DialogDescription>
            Move money between two accounts in different currencies. The position is held in the
            destination currency and valued in your default currency everywhere else.
          </DialogDescription>
        </DialogHeader>
        {cash.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            Add at least two accounts (one per currency) before making an exchange.
          </p>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From account</Label>
                <Select value={fromId} onValueChange={setFromId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{cash.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>To account</Label>
                <Select value={toId} onValueChange={setToId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{cash.filter((a) => a.id !== fromId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div><Label>Amount {from ? `(${from.currency})` : ""}</Label><Input className="mt-1.5" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
              <div><Label>Fees</Label><Input className="mt-1.5" type="number" step="0.01" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0.00" /></div>
              <div><Label>Rate</Label><Input className="mt-1.5" type="number" step="0.000001" value={rate} onChange={(e) => setRate(e.target.value)} required /></div>
              <div><Label>Date</Label><Input className="mt-1.5" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {from && to ? `1 ${from.currency} = ${rate || "?"} ${to.currency}` : "Pick accounts to fetch a live rate"}
              </span>
              <div className="flex items-center gap-3">
                {to && <span className="num font-medium">{received > 0 ? `${received.toFixed(2)} ${to.currency}` : "—"}</span>}
                <Button type="button" size="sm" variant="outline" onClick={fetchRate} disabled={!from || !to || loading}>
                  {loading ? "Fetching…" : "Live rate"}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Record exchange</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
