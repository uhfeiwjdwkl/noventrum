// Types + pure selector helpers. All mutable state lives in `./store`.

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
  date: string;
  accountId: string;
  amount: number;
  kind: TxnKind;
  category: string;
  merchant: string;
  notes?: string;
  tags?: string[];
  recurring?: boolean;
  currency?: string;
}

export type AssetClass = "stock" | "etf" | "commodity" | "cash" | "crypto" | "other";

export interface Holding {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  shares: number;
  avgCost: number;
  price: number;
  dayChangePct: number;
  sector?: string;
  currency?: string;
  priceUpdatedAt?: string;
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
  tax?: number;
  accountId: string;
  currency?: string;
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
  accountId?: string;
  currency?: string;
  tax?: number;
}

/** Real estate. Valuation history for back-calculated net-worth. */
export interface Property {
  id: string;
  name: string;
  address?: string;
  purchaseDate: string;
  purchasePrice: number;
  fees: number;
  tax: number;
  currentValue: number;
  currency: string;
  linkedMortgageAccountId?: string;
  soldDate?: string;
  soldPrice?: number;
  valuations: { date: string; value: number }[];
  notes?: string;
}

/** Physical assets: vehicles, collectibles, jewelry, etc. */
export interface PhysicalAsset {
  id: string;
  name: string;
  category: string; // e.g. Vehicle, Jewelry, Art
  purchaseDate: string;
  purchasePrice: number;
  fees: number;
  tax: number;
  currentValue: number;
  currency: string;
  soldDate?: string;
  soldPrice?: number;
  notes?: string;
}

export interface IncomeSource {
  id: string;
  name: string;
  kind: "salary" | "rental" | "side" | "dividend" | "interest" | "other";
  monthly: number;
  currency: string;
  active: boolean;
}

/** Cached historical prices for one symbol, indexed by ISO date. */
export interface PriceSeries {
  symbol: string;
  currency?: string;
  updatedAt: string;
  points: { date: string; close: number }[];
}

// ---- derived metrics (pure) ----

export function convert(
  amount: number,
  from: string | undefined,
  to: string,
  fxRates: Record<string, number>,
): number {
  if (!from || from === to) return amount;
  // fxRates: map from currency code -> value in base currency (`to`)
  const rateFrom = fxRates[from];
  if (rateFrom && to === fxRates.__base) return amount * rateFrom;
  // fallback: rates keyed as "USDEUR" style
  const key = `${from}${to}`;
  if (fxRates[key]) return amount * fxRates[key];
  return amount;
}

export function totalAssets(accounts: Account[]) {
  return accounts.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0);
}
export function totalLiabilities(accounts: Account[]) {
  return -accounts.filter((a) => a.balance < 0).reduce((s, a) => s + a.balance, 0);
}
export function netWorth(accounts: Account[]) {
  return totalAssets(accounts) - totalLiabilities(accounts);
}
export function portfolioValue(holdings: Holding[]) {
  return holdings.reduce((s, h) => s + h.shares * h.price, 0);
}
export function portfolioCost(holdings: Holding[]) {
  return holdings.reduce((s, h) => s + h.shares * h.avgCost, 0);
}
export function propertyValue(properties: Property[]) {
  return properties
    .filter((p) => !p.soldDate)
    .reduce((s, p) => s + p.currentValue, 0);
}
export function physicalValue(assets: PhysicalAsset[]) {
  return assets
    .filter((a) => !a.soldDate)
    .reduce((s, a) => s + a.currentValue, 0);
}

/** Total net worth including holdings, real estate and physical assets. */
export function totalNetWorth(
  accounts: Account[],
  holdings: Holding[],
  properties: Property[],
  physical: PhysicalAsset[],
) {
  return (
    netWorth(accounts) +
    portfolioValue(holdings) +
    propertyValue(properties) +
    physicalValue(physical)
  );
}

export function monthKey(d: string) {
  return d.slice(0, 7);
}

export function monthlyCashflow(transactions: Transaction[]) {
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

/**
 * Back-calculate net-worth month by month from transactions + holdings
 * historical prices + property/physical valuations. No manual snapshots.
 */
export function netWorthSeries(
  accounts: Account[],
  transactions: Transaction[],
  holdings: Holding[] = [],
  properties: Property[] = [],
  physical: PhysicalAsset[] = [],
): { month: string; value: number }[] {
  const now = totalNetWorth(accounts, holdings, properties, physical);
  const cf = monthlyCashflow(transactions);
  if (cf.length === 0) return [];

  // For each month, use holdings' historical close for that month if available,
  // else the current price. For properties/physical, use closest valuation.
  const monthPortfolio = (month: string) => {
    let total = 0;
    for (const h of holdings) {
      const pt = [...h.history].reverse().find((p) => p.date.slice(0, 7) <= month);
      const price = pt?.price ?? h.price;
      total += h.shares * price;
    }
    return total;
  };
  const monthProperty = (month: string) => {
    let total = 0;
    for (const p of properties) {
      if (p.purchaseDate.slice(0, 7) > month) continue;
      if (p.soldDate && p.soldDate.slice(0, 7) < month) continue;
      const v = [...p.valuations].reverse().find((x) => x.date.slice(0, 7) <= month);
      total += v?.value ?? p.currentValue;
    }
    return total;
  };
  const monthPhysical = (month: string) => {
    let total = 0;
    for (const a of physical) {
      if (a.purchaseDate.slice(0, 7) > month) continue;
      if (a.soldDate && a.soldDate.slice(0, 7) < month) continue;
      total += a.currentValue;
    }
    return total;
  };

  const currentAccountsPortion = netWorth(accounts);
  const series: { month: string; value: number }[] = [];
  let cash = currentAccountsPortion;
  for (let i = cf.length - 1; i >= 0; i--) {
    const m = cf[i].month;
    const val = cash + monthPortfolio(m) + monthProperty(m) + monthPhysical(m);
    series.unshift({ month: m, value: Math.round(val) });
    cash -= cf[i].net;
  }
  // sanity: replace last point with current computed
  if (series.length) series[series.length - 1] = { month: series[series.length - 1].month, value: Math.round(now) };
  return series;
}

export function spendingByCategory(transactions: Transaction[], days = 30) {
  const map = new Map<string, number>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  for (const t of transactions) {
    if (t.kind !== "expense") continue;
    if (new Date(t.date) < cutoff) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + -t.amount);
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

const SIDE_CATEGORIES = new Set([
  "side",
  "side income",
  "rental",
  "rent",
  "freelance",
  "hobby",
  "gig",
  "consulting",
  "royalty",
]);

export function isSideIncome(category: string) {
  return SIDE_CATEGORIES.has(category.toLowerCase());
}

export function incomeBySource(transactions: Transaction[]) {
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

export function savingsRateSeries(transactions: Transaction[]) {
  return monthlyCashflow(transactions).map((m) => ({
    month: m.month,
    rate: m.income > 0 ? Math.max(0, Math.round(((m.income - m.expense) / m.income) * 1000) / 10) : 0,
  }));
}

export function assetAllocation(
  holdings: Holding[],
  properties: Property[] = [],
  physical: PhysicalAsset[] = [],
) {
  const map = new Map<string, number>();
  for (const h of holdings) {
    const v = h.shares * h.price;
    map.set(h.assetClass, (map.get(h.assetClass) ?? 0) + v);
  }
  const pv = propertyValue(properties);
  if (pv > 0) map.set("property", pv);
  const ph = physicalValue(physical);
  if (ph > 0) map.set("physical", ph);
  return Array.from(map.entries()).map(([k, v]) => ({ name: k, value: Math.round(v) }));
}

export function fmtCurrency(
  n: number,
  opts: { compact?: boolean; currency?: string } = {},
) {
  const currency = opts.currency ?? "USD";
  if (!isFinite(n)) return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(0);
  if (opts.compact && Math.abs(n) >= 1000) {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    const sym = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "$";
    if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}
export function fmtPct(n: number) {
  if (!isFinite(n)) return "0.00%";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
