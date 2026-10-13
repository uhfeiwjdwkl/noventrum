import { OwnSymbolSearch } from "@/components/finance/OwnSymbolSearch";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { useFinance, useFinanceApi } from "@/lib/finance/store";
import type { AssetClass, Dividend, Trade } from "@/lib/finance/data";
import { getFxRateAt, getPriceAt } from "@/lib/prices.functions";
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
  defaultSymbol,
  defaultName,
  defaultAssetClass,
  defaultCurrency,
  editTrade,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  defaultSide?: "buy" | "sell";
  defaultSymbol?: string;
  defaultName?: string;
  defaultAssetClass?: AssetClass;
  defaultCurrency?: string;
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

  const [symbol, setSymbol] = useState(editTrade?.symbol ?? defaultSymbol ?? "");
  const [name, setName] = useState(editTrade?.name ?? defaultName ?? "");
  const [assetClass, setAssetClass] = useState<AssetClass>(editTrade?.assetClass ?? defaultAssetClass ?? "stock");
  const [side, setSide] = useState<"buy" | "sell">(editTrade?.side ?? defaultSide ?? "buy");
  const [shares, setShares] = useState(editTrade ? String(editTrade.shares) : "");
  const [price, setPrice] = useState(editTrade ? String(editTrade.price) : "");
  const [fees, setFees] = useState(editTrade?.fees ? String(editTrade.fees) : "");
  const [tax, setTax] = useState(editTrade?.tax ? String(editTrade.tax) : "");
  const [date, setDate] = useState(editTrade?.date ?? today());
  const [accountId, setAccountId] = useState<string>(editTrade?.accountId ?? "");
  const financeApi = useFinanceApi();
  const [currency, setCurrency] = useState(editTrade?.currency ?? defaultCurrency ?? financeApi.getState().settings.baseCurrency);
  const [loading, setLoading] = useState(false);

  // Whenever the date (or asset) changes, pull that day's close from the price sources.
  const skipFirst = useRef(!!editTrade);
  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return; }
    const sym = symbol.trim();
    if (!sym || !date || assetClass === "forex") return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await getPriceAt({ data: { symbol: sym, date } });
        if (!cancelled && r && r.price > 0) {
          setPrice(r.price < 1 ? r.price.toFixed(6) : r.price.toFixed(2));
          if (r.currency) setCurrency(r.currency);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, symbol]);

  // Quantity currently held for this symbol, so "Sell all" needs no maths.
  const trades = useFinance((s) => s.trades);
  const heldShares = (() => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return 0;
    const q = trades
      .filter((t) => t.symbol === sym && t.id !== editTrade?.id)
      .reduce((sum, t) => sum + (t.side === "buy" ? t.shares : -t.shares), 0);
    return Math.max(0, Math.round(q * 1e8) / 1e8);
  })();

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
                    setSymbol(m.symbol); // price for the chosen date is fetched automatically
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
            <div>
              <div className="flex items-center justify-between">
                <Label>Quantity</Label>
                {side === "sell" && heldShares > 0 && (
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => setShares(String(heldShares))}
                  >
                    Sell all ({heldShares})
                  </button>
                )}
              </div>
              <Input className="mt-1.5" type="number" step="0.0001" value={shares} onChange={(e) => setShares(e.target.value)} required />
            </div>
            <div><Label>Price{loading && <span className="ml-1 text-[10px] text-muted-foreground">fetching…</span>}</Label><Input className="mt-1.5" type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
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
  trigger, open, onOpenChange, editDividend, defaultSymbol,
}: { trigger?: ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void; editDividend?: Dividend; defaultSymbol?: string }) {
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
  const financeApi = useFinanceApi();
  const [currency, setCurrency] = useState(financeApi.getState().settings.baseCurrency);
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
  const financeApi = useFinanceApi();
  const [currency, setCurrency] = useState(financeApi.getState().settings.baseCurrency);
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
  trigger, open, onOpenChange, editDividend, defaultSymbol,
}: { trigger?: ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void; editDividend?: Dividend; defaultSymbol?: string }) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const addDividend = useFinance((s) => s.addDividend);
  const updateDividend = useFinance((s) => s.updateDividend);
  const holdings = useFinance((s) => s.holdings);
  const accounts = useFinance((s) => s.accounts);
  const brokerage = accounts;

  const [date, setDate] = useState(editDividend?.date ?? today());
  const [symbol, setSymbol] = useState(editDividend?.symbol ?? defaultSymbol ?? "");
  const [amount, setAmount] = useState(editDividend ? String(editDividend.amount) : "");
  const [tax, setTax] = useState(editDividend?.tax ? String(editDividend.tax) : "");
  const [accountId, setAccountId] = useState(editDividend?.accountId ?? "");
  const financeApi = useFinanceApi();
  const [currency, setCurrency] = useState(editDividend?.currency ?? financeApi.getState().settings.baseCurrency);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol.trim() || !amount) return;
    const d = {
      date, symbol: symbol.trim().toUpperCase(),
      amount: Number(amount), tax: Number(tax) || 0,
      accountId: accountId || undefined, currency,
    };
    if (editDividend) updateDividend(editDividend.id, d); else addDividend(d);
    toast.success(editDividend ? "Dividend updated" : "Dividend logged");
    setSymbol(""); setAmount(""); setTax("");
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDividend ? "Edit dividend" : "Log dividend"}</DialogTitle>
          <DialogDescription>Cash dividends. Always written to an account ledger (defaults to where the asset is held), net of withholding tax.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Date</Label><Input className="mt-1.5" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div>
              <Label>Symbol</Label>
              {holdings.length && !editDividend && !defaultSymbol ? (
                <div className="mt-1.5"><OwnSymbolSearch value={symbol} onChange={setSymbol} onSelect={(h) => { setSymbol(h.symbol); if (h.currency) setCurrency(h.currency); }} /></div>
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
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Where the asset is held" /></SelectTrigger>
                  <SelectContent>{brokerage.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{editDividend ? "Save" : "Log dividend"}</Button>
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
  const financeApi = useFinanceApi();
  const [currency, setCurrency] = useState(financeApi.getState().settings.baseCurrency);

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
  trigger, open, onOpenChange, defaultAccountId,
}: { trigger?: ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void; defaultAccountId?: string }) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const accounts = useFinance((s) => s.accounts);
  const recordExchange = useFinance((s) => s.recordExchange);
  const recordInAccountFx = useFinance((s) => s.recordInAccountFx);
  const cash = accounts.filter((a) => ["checking", "savings", "cash", "brokerage"].includes(a.type));

  const [mode, setMode] = useState<"same" | "between">("same");
  const [fromId, setFromId] = useState(defaultAccountId ?? "");
  const [toId, setToId] = useState("");
  const [fromCur, setFromCur] = useState("");
  const [toCur, setToCur] = useState("");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [fees, setFees] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (isOpen && defaultAccountId) setFromId(defaultAccountId); }, [isOpen, defaultAccountId]);

  const from = cash.find((a) => a.id === fromId);
  const to = cash.find((a) => a.id === toId);
  const srcCur = mode === "same" ? (fromCur || from?.currency || "") : (from?.currency ?? "");
  const dstCur = mode === "same" ? toCur : (to?.currency ?? "");
  const received = (Number(amount) - (Number(fees) || 0)) * (Number(rate) || 0);

  async function fetchRate() {
    if (!srcCur || !dstCur) return;
    setLoading(true);
    try {
      const r = await getFxRateAt({ data: { from: srcCur, to: dstCur, date } });
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
    if (!from) return toast.error("Pick an account");
    if (!amount || !rate) return toast.error("Enter an amount and rate");
    if (mode === "same") {
      if (!dstCur || dstCur === srcCur) return toast.error("Pick a different currency to convert into");
      recordInAccountFx({ date, accountId: from.id, fromCurrency: srcCur, toCurrency: dstCur, amount: Number(amount), rate: Number(rate), fees: Number(fees) || 0, notes: notes.trim() || undefined });
    } else {
      if (!to || from.id === to.id) return toast.error("Pick two different accounts");
      recordExchange({ date, fromAccountId: from.id, toAccountId: to.id, amount: Number(amount), rate: Number(rate), fees: Number(fees) || 0, notes: notes.trim() || undefined });
    }
    toast.success(`Exchanged ${srcCur} → ${dstCur}`);
    setAmount(""); setRate(""); setFees(""); setNotes(""); setToCur("");
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Forex transaction</DialogTitle>
          <DialogDescription>
            Convert money into another currency — kept in the same account, or moved to another account.
            Foreign cash is valued at today's exchange rate in the account balance.
          </DialogDescription>
        </DialogHeader>
        {cash.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add an account first.</p>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-1">
              {(["same", "between"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={"rounded px-2 py-1.5 text-sm transition " + (mode === m ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                  {m === "same" ? "Within one account" : "Between accounts"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{mode === "same" ? "Account" : "From account"}</Label>
                <Select value={fromId} onValueChange={(v) => { setFromId(v); setFromCur(""); }}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{cash.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {mode === "between" ? (
                <div>
                  <Label>To account</Label>
                  <Select value={toId} onValueChange={setToId}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{cash.filter((a) => a.id !== fromId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : <div />}
            </div>
            {mode === "same" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Convert from</Label><CurrencyPicker value={srcCur} onChange={setFromCur} className="mt-1.5" /></div>
                <div><Label>Convert into</Label><CurrencyPicker value={toCur} onChange={setToCur} className="mt-1.5" /></div>
              </div>
            )}
            <div className="grid grid-cols-4 gap-3">
              <div><Label>Amount {srcCur ? `(${srcCur})` : ""}</Label><Input className="mt-1.5" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
              <div><Label>Fees</Label><Input className="mt-1.5" type="number" step="0.01" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0.00" /></div>
              <div><Label>Rate</Label><Input className="mt-1.5" type="number" step="0.000001" value={rate} onChange={(e) => setRate(e.target.value)} required /></div>
              <div><Label>Date</Label><Input className="mt-1.5" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {srcCur && dstCur ? `1 ${srcCur} = ${rate || "?"} ${dstCur}` : "Pick currencies to fetch a rate"}
              </span>
              <div className="flex items-center gap-3">
                {dstCur && <span className="num font-medium">{received > 0 ? `${received.toFixed(2)} ${dstCur}` : "—"}</span>}
                <Button type="button" size="sm" variant="outline" onClick={fetchRate} disabled={!srcCur || !dstCur || loading}>
                  {loading ? "Fetching…" : "Rate on date"}
                </Button>
              </div>
            </div>
            <div><Label>Notes</Label><Input className="mt-1.5" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></div>
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

/* ------------------------------ Transfer ------------------------------ */

export function TransferDialog({
  trigger, open, onOpenChange, defaultAccountId,
}: { trigger?: ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void; defaultAccountId?: string }) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const accounts = useFinance((s) => s.accounts);
  const recordTransfer = useFinance((s) => s.recordTransfer);
  const [fromId, setFromId] = useState(defaultAccountId ?? "");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [received, setReceived] = useState("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");

  useEffect(() => { if (isOpen && defaultAccountId) setFromId(defaultAccountId); }, [isOpen, defaultAccountId]);

  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  const crossCur = !!from && !!to && from.currency !== to.currency;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to || from.id === to.id) return toast.error("Choose two different accounts");
    const amt = Math.abs(Number(amount) || 0);
    if (!amt) return toast.error("Enter an amount");
    if (crossCur && !Number(received)) return toast.error(`Enter the amount received in ${to.currency}`);
    recordTransfer({ date, fromAccountId: from.id, toAccountId: to.id, amount: amt, received: crossCur ? Number(received) : undefined, notes: notes.trim() || undefined });
    toast.success(`Moved to ${to.name}`);
    setAmount(""); setReceived(""); setNotes(""); setToId("");
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer between accounts</DialogTitle>
          <DialogDescription>Move money between your own accounts. Transfers don't count as income or spending.</DialogDescription>
        </DialogHeader>
        {accounts.length < 2 ? (
          <p className="text-sm text-muted-foreground">Add at least two accounts first.</p>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From</Label>
                <Select value={fromId} onValueChange={setFromId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>To</Label>
                <Select value={toId} onValueChange={setToId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{accounts.filter((a) => a.id !== fromId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount {from ? `(${from.currency})` : ""}</Label><Input className="mt-1.5" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
              <div><Label>Date</Label><Input className="mt-1.5" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            </div>
            {crossCur && (
              <div><Label>Received ({to!.currency})</Label><Input className="mt-1.5" type="number" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} required /></div>
            )}
            <div><Label>Notes</Label><Input className="mt-1.5" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Record transfer</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
