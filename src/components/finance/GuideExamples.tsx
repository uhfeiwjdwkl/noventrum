import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Coins, Play, RotateCcw, TrendingUp, Wallet } from "lucide-react";
import { createPracticeFinance, FinanceProvider, useFinance } from "@/lib/finance/store";
import { AddAccountDialog, AddBudgetDialog, AddGoalDialog, AddTransactionDialog } from "./AddDialogs";
import { AddDividendDialog, BuySellDialog, ExchangeDialog, TransferDialog } from "./ExtraDialogs";
import { AccountDialog } from "./AccountDialog";
import { ValuationDialog } from "./ValuationDialog";
import { PriceChart } from "./PriceChart";
import { BulkControls, refForTxn, SelectBox, useSelection } from "./BulkEdit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { HistoryPoint } from "@/lib/prices.functions";

const money = (value: number, currency = "AUD") => new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(value);
const EXAMPLES: Record<string, { title: string; task: string }> = {
  "getting-started": { title: "Create a practice account", task: "Try adding a savings account with a $500 opening balance." },
  accounts: { title: "Explore an account", task: "Open Everyday, add money in or out, then check its dated ledger and chart." },
  transactions: { title: "Record a practice payment", task: "Log $25 of groceries, or try a recurring income payment. Your new entry appears below." },
  transfers: { title: "Move $100 between accounts", task: "Choose Everyday as From and Savings as To. Look for the two matching entries, both marked Transfer." },
  forex: { title: "Convert $100 AUD into USD", task: "Use Everyday, AUD → USD, a $2 fee and a 0.65 rate. The ledger should show −A$100 and US$63.70." },
  investments: { title: "Buy or sell a practice investment", task: "BHP is already selected. Try buying 2 shares with a $2 fee, then check the holding and cash entry below. Quotes are live; the starting entries are illustrative." },
  dividends: { title: "Receive a dividend", task: "Log a $10 BHP dividend with $2 tax. The account ledger receives $8, not $10." },
  charts: { title: "Compare price and position", task: "Switch on My position, change periods, and select two chart points. These sample prices are illustrative, not market quotes." },
  "bulk-edit": { title: "Edit a practice ledger", task: "Press Bulk edit, select entries, and change their date or category. You can also delete them and reset the example." },
  assets: { title: "Change a bicycle’s valuation", task: "Open Value history and add a dated $600 valuation. Watch the history and current value update." },
  planning: { title: "Create a budget or goal", task: "Try a Food budget or a savings goal. Your practice records appear below." },
};

function seededStore() {
  const store = createPracticeFinance();
  const s = store.getState();
  const date = new Date().toISOString().slice(0, 10);
  const past = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  store.setState({ accounts: [
    { id: "practice-everyday", name: "Everyday", institution: "Example bank", type: "checking", balance: 1000, balanceDate: past(180), currency: "AUD" },
    { id: "practice-savings", name: "Savings", institution: "Example bank", type: "savings", balance: 500, balanceDate: past(180), currency: "AUD" },
    { id: "practice-broker", name: "Brokerage", institution: "Example broker", type: "brokerage", balance: 2000, balanceDate: past(180), currency: "AUD" },
  ] });
  s.addTransaction({ date: past(60), accountId: "practice-everyday", amount: 250, kind: "income", category: "Salary", merchant: "Example employer", currency: "AUD" });
  s.addTransaction({ date: past(30), accountId: "practice-everyday", amount: -40, kind: "expense", category: "Food", merchant: "Example groceries", currency: "AUD" });
  s.recordTrade({ date: past(120), symbol: "BHP.AX", name: "BHP Group Limited", assetClass: "stock", side: "buy", shares: 10, price: 40, fees: 2, accountId: "practice-broker", currency: "AUD" });
  s.recordTrade({ date: past(30), symbol: "BHP.AX", name: "BHP Group Limited", assetClass: "stock", side: "sell", shares: 2, price: 44, fees: 2, accountId: "practice-broker", currency: "AUD" });
  s.addDividend({ date: past(15), symbol: "BHP.AX", amount: 10, tax: 2, accountId: "practice-broker", currency: "AUD" });
  s.addPhysicalAsset({ name: "Example bicycle", category: "Other", purchaseDate: past(180), purchasePrice: 800, currentValue: 700, currency: "AUD", fees: 0, tax: 0, valuations: [{ date: past(180), value: 800 }, { date: past(30), value: 700 }] });
  const points: HistoryPoint[] = Array.from({ length: 181 }, (_, i) => ({ date: past(180 - i), close: Math.round((40 + i / 30 + Math.sin(i / 12) * 3) * 100) / 100 }));
  return { store, points, date };
}

export function GuideExample({ section }: { section: string }) {
  const example = EXAMPLES[section];
  const [active, setActive] = useState(false);
  const [version, setVersion] = useState(0);
  if (!example) return null;
  return (
    <div className="mt-6 min-w-0 border-y border-border bg-muted/20 py-5" aria-label={example.title}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{example.title}</h3><Badge variant="outline">Practice only</Badge></div>
        {active ? <Button size="sm" variant="ghost" onClick={() => setVersion((v) => v + 1)}><RotateCcw className="mr-1.5 h-4 w-4" />Reset example</Button> : <Button size="sm" variant="outline" onClick={() => setActive(true)}><Play className="mr-1.5 h-4 w-4" />Try example</Button>}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{example.task}</p>
      {active && <Practice key={version} section={section} />}
    </div>
  );
}

function Practice({ section }: { section: string }) {
  const [seed] = useState(seededStore);
  return <FinanceProvider store={seed.store}><PracticeControls section={section} points={seed.points} /></FinanceProvider>;
}

function PracticeControls({ section, points }: { section: string; points: HistoryPoint[] }) {
  const accounts = useFinance((s) => s.accounts);
  const transactions = useFinance((s) => s.transactions);
  const holdings = useFinance((s) => s.holdings);
  const trades = useFinance((s) => s.trades);
  const dividends = useFinance((s) => s.dividends);
  const assets = useFinance((s) => s.physicalAssets);
  const budgets = useFinance((s) => s.budgets);
  const goals = useFinance((s) => s.goals);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [valuationOpen, setValuationOpen] = useState(false);
  const sel = useSelection();
  const ledger = useMemo(() => [...transactions].sort((a, b) => b.date.localeCompare(a.date)), [transactions]);
  const btn = "gap-1.5";
  return (
    <div className="mt-4 min-w-0 space-y-4">
      <p className="text-xs text-muted-foreground">Sample finances only · Nothing here is saved or synced to your account.</p>
      <div className="flex flex-wrap gap-2">
        {section === "getting-started" && <AddAccountDialog trigger={<Button size="sm" variant="outline" className={btn}><Wallet className="h-4 w-4" />Add account</Button>} />}
        {section === "accounts" && accounts.map((a) => <Button key={a.id} size="sm" variant="outline" onClick={() => setAccountId(a.id)}><Wallet className="mr-1.5 h-4 w-4" />{a.name}</Button>)}
        {(section === "transactions" || section === "accounts") && <>
          <AddTransactionDialog defaultKind="income" defaultAccountId="practice-everyday" trigger={<Button size="sm" variant="outline" className={btn}><ArrowDownLeft className="h-4 w-4" />Money in</Button>} />
          <AddTransactionDialog defaultKind="expense" defaultAccountId="practice-everyday" trigger={<Button size="sm" variant="outline" className={btn}><ArrowUpRight className="h-4 w-4" />Money out</Button>} />
        </>}
        {section === "transfers" && <TransferDialog defaultAccountId="practice-everyday" trigger={<Button size="sm" variant="outline" className={btn}><ArrowLeftRight className="h-4 w-4" />Transfer</Button>} />}
        {section === "forex" && <ExchangeDialog defaultAccountId="practice-everyday" trigger={<Button size="sm" variant="outline" className={btn}><Coins className="h-4 w-4" />Forex</Button>} />}
        {section === "investments" && <BuySellDialog defaultSymbol="BHP.AX" defaultName="BHP Group Limited" defaultCurrency="AUD" trigger={<Button size="sm" variant="outline" className={btn}><TrendingUp className="h-4 w-4" />Buy / Sell</Button>} />}
        {section === "dividends" && <AddDividendDialog defaultSymbol="BHP.AX" trigger={<Button size="sm" variant="outline" className={btn}><Coins className="h-4 w-4" />Log dividend</Button>} />}
        {section === "bulk-edit" && <BulkControls sel={sel} all={ledger.map(refForTxn)} />}
        {section === "assets" && <Button size="sm" variant="outline" onClick={() => setValuationOpen(true)}>Value history</Button>}
        {section === "planning" && <><AddBudgetDialog trigger={<Button size="sm" variant="outline">Add budget</Button>} /><AddGoalDialog trigger={<Button size="sm" variant="outline">Add goal</Button>} /></>}
      </div>
      {section === "getting-started" && <ul className="space-y-2 text-sm">{accounts.map((a) => <li key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2"><span>{a.name} · {a.type}</span><span className="num">{money(a.balance, a.currency)}</span></li>)}</ul>}
      {section === "investments" && holdings.map((h) => <div key={h.id} className="text-sm font-medium">{h.symbol} · {h.shares} shares · average cost {money(h.avgCost, h.currency)}</div>)}
      {section === "assets" && assets.map((a) => <p key={a.id} className="text-sm">{a.name} · current value <strong className="num">{money(a.currentValue, a.currency)}</strong></p>)}
      {section === "planning" && <div className="space-y-2 text-sm" aria-live="polite">{budgets.length + goals.length === 0 && <p className="text-muted-foreground">No practice budgets or goals yet.</p>}{budgets.map((b) => <p key={b.id}>{b.category} · monthly limit {money(b.limit)}</p>)}{goals.map((g) => <p key={g.id}>{g.name} · {money(g.current)} / {money(g.target)}</p>)}</div>}
      {section === "charts" ? <PriceChart symbol="BHP.AX" currency="AUD" trades={trades} dividends={dividends} examplePoints={points} height={280} defaultRange="Since first" /> : !["getting-started", "assets", "planning"].includes(section) && <div className="min-w-0" aria-live="polite"><Table>
        <TableHeader><TableRow>{sel.active && <TableHead />}<TableHead>Date</TableHead><TableHead>Entry</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
        <TableBody>{ledger.map((t) => <TableRow key={t.id}>{sel.active && <TableCell><SelectBox label={`Select ${t.merchant}`} checked={sel.has(refForTxn(t))} onChange={(v) => sel.toggle(refForTxn(t), v)} /></TableCell>}<TableCell className="whitespace-nowrap num">{t.date}</TableCell><TableCell><div className="font-medium">{t.merchant}</div><div className="text-xs text-muted-foreground">{t.category}{t.notes ? ` · ${t.notes}` : ""}</div></TableCell><TableCell>{accounts.find((a) => a.id === t.accountId)?.name}</TableCell><TableCell className={`text-right whitespace-nowrap num ${t.amount > 0 ? "text-success" : ""}`}>{money(t.amount, t.currency)}</TableCell></TableRow>)}</TableBody>
      </Table></div>}
      <AccountDialog accountId={accountId} open={Boolean(accountId)} onOpenChange={(open) => { if (!open) setAccountId(null); }} />
      <ValuationDialog kind="physical" id={assets[0]?.id ?? null} open={valuationOpen} onOpenChange={setValuationOpen} />
    </div>
  );
}