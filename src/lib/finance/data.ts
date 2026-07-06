// Data layer — starts empty. Populate via the app's UI.

export type AccountType =
  | "checking"
  | "savings"
  | "credit"
  | "brokerage"
  | "cash"
  | "loan"
  | "mortgage";

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  balance: number;
  currency: string;
}

export type TxnKind = "income" | "expense" | "transfer" | "trade";

export interface Transaction {
  id: string;
  date: string; // ISO
  accountId: string;
  amount: number; // positive = inflow, negative = outflow
  kind: TxnKind;
  category: string;
  merchant: string;
  notes?: string;
  tags?: string[];
  recurring?: boolean;
}

export interface Holding {
  id: string;
  symbol: string;
  name: string;
  assetClass: "stock" | "etf" | "commodity" | "cash" | "crypto" | "other";
  shares: number;
  avgCost: number;
  price: number;
  dayChangePct: number;
  sector?: string;
  history: { date: string; price: number }[];
}

export interface Trade {
  id: string;
  date: string;
  symbol: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  fees: number;
  accountId: string;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  spent: number;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  monthlyContribution: number;
}

export interface Dividend {
  id: string;
  date: string;
  symbol: string;
  amount: number;
}

export const accounts: Account[] = [];
export const transactions: Transaction[] = [];
export const holdings: Holding[] = [];
export const trades: Trade[] = [];
export const budgets: Budget[] = [];
export const goals: Goal[] = [];
export const dividends: Dividend[] = [];

// ---- derived metrics ----
export function totalAssets() {
  return accounts.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0);
}
export function totalLiabilities() {
  return -accounts.filter((a) => a.balance < 0).reduce((s, a) => s + a.balance, 0);
}
export function netWorth() {
  return totalAssets() - totalLiabilities();
}
export function portfolioValue() {
  return holdings.reduce((s, h) => s + h.shares * h.price, 0);
}
export function portfolioCost() {
  return holdings.reduce((s, h) => s + h.shares * h.avgCost, 0);
}

export function monthKey(d: string) {
  return d.slice(0, 7);
}

export function monthlyCashflow() {
  const map = new Map<string, { income: number; expense: number }>();
  for (const t of transactions) {
    if (t.kind !== "income" && t.kind !== "expense") continue;
    const k = monthKey(t.date);
    const cur = map.get(k) ?? { income: 0, expense: 0 };
    if (t.amount > 0) cur.income += t.amount;
    else cur.expense += -t.amount;
    map.set(k, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, v]) => ({ month, ...v, net: v.income - v.expense }));
}

export function netWorthSeries(): { month: string; value: number }[] {
  return [];
}

export function spendingByCategory() {
  const map = new Map<string, number>();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 1);
  for (const t of transactions) {
    if (t.kind !== "expense") continue;
    if (new Date(t.date) < cutoff) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + -t.amount);
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

export function incomeBySource() {
  const map = new Map<string, number>();
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  for (const t of transactions) {
    if (t.kind !== "income") continue;
    if (new Date(t.date) < cutoff) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return Array.from(map.entries())
    .map(([source, amount]) => ({ source, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

export function savingsRateSeries() {
  return monthlyCashflow().map((m) => ({
    month: m.month,
    rate: m.income > 0 ? Math.max(0, Math.round(((m.income - m.expense) / m.income) * 1000) / 10) : 0,
  }));
}

export function assetAllocation() {
  const map = new Map<string, number>();
  for (const h of holdings) {
    const v = h.shares * h.price;
    map.set(h.assetClass, (map.get(h.assetClass) ?? 0) + v);
  }
  return Array.from(map.entries()).map(([k, v]) => ({ name: k, value: Math.round(v) }));
}

export function fmtCurrency(n: number, opts: { compact?: boolean } = {}) {
  if (opts.compact && Math.abs(n) >= 1000) {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}
export function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
