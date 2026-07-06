// Deterministic PRNG for reproducible sample data
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

const rand = mulberry32(42);

const CATEGORIES = {
  income: ["Salary", "Dividends", "Interest", "Freelance", "Bonus", "Refunds"],
  expense: [
    "Groceries",
    "Rent",
    "Utilities",
    "Dining",
    "Transport",
    "Entertainment",
    "Health",
    "Shopping",
    "Subscriptions",
    "Travel",
    "Insurance",
    "Education",
  ],
};

export const accounts: Account[] = [
  { id: "a1", name: "Everyday Checking", institution: "Chase", type: "checking", balance: 8420.5, currency: "USD" },
  { id: "a2", name: "High-Yield Savings", institution: "Ally", type: "savings", balance: 45280.12, currency: "USD" },
  { id: "a3", name: "Emergency Fund", institution: "Marcus", type: "savings", balance: 22000, currency: "USD" },
  { id: "a4", name: "Brokerage", institution: "Fidelity", type: "brokerage", balance: 187650.34, currency: "USD" },
  { id: "a5", name: "Roth IRA", institution: "Vanguard", type: "brokerage", balance: 64230.9, currency: "USD" },
  { id: "a6", name: "Sapphire Credit", institution: "Chase", type: "credit", balance: -2340.75, currency: "USD" },
  { id: "a7", name: "Cash Wallet", institution: "—", type: "cash", balance: 320, currency: "USD" },
  { id: "a8", name: "Auto Loan", institution: "Toyota Financial", type: "loan", balance: -14200, currency: "USD" },
  { id: "a9", name: "Mortgage", institution: "Wells Fargo", type: "mortgage", balance: -284500, currency: "USD" },
];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function generateTransactions(): Transaction[] {
  const txns: Transaction[] = [];
  const today = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 18);

  let id = 1;
  // Monthly recurring salary + rent + subscriptions
  for (let m = 0; m < 18; m++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + m);

    // Salary bi-monthly
    for (const day of [1, 15]) {
      const dt = new Date(d.getFullYear(), d.getMonth(), day);
      if (dt > today) continue;
      txns.push({
        id: String(id++),
        date: iso(dt),
        accountId: "a1",
        amount: 4250,
        kind: "income",
        category: "Salary",
        merchant: "Acme Corp",
        recurring: true,
      });
    }
    // Rent
    const rentDate = new Date(d.getFullYear(), d.getMonth(), 3);
    if (rentDate <= today) {
      txns.push({
        id: String(id++),
        date: iso(rentDate),
        accountId: "a1",
        amount: -2100,
        kind: "expense",
        category: "Rent",
        merchant: "Skyline Apartments",
        recurring: true,
      });
    }
    // Subscriptions
    const subs = [
      ["Netflix", 15.99],
      ["Spotify", 10.99],
      ["iCloud", 2.99],
      ["Gym", 39.0],
      ["NYT", 17.0],
    ] as const;
    subs.forEach(([m2, amt], i) => {
      const sd = new Date(d.getFullYear(), d.getMonth(), 5 + i);
      if (sd <= today)
        txns.push({
          id: String(id++),
          date: iso(sd),
          accountId: "a6",
          amount: -amt,
          kind: "expense",
          category: "Subscriptions",
          merchant: m2,
          recurring: true,
        });
    });
    // Utilities
    const utilDate = new Date(d.getFullYear(), d.getMonth(), 12);
    if (utilDate <= today)
      txns.push({
        id: String(id++),
        date: iso(utilDate),
        accountId: "a1",
        amount: -145.32 - rand() * 40,
        kind: "expense",
        category: "Utilities",
        merchant: "ConEd",
        recurring: true,
      });
    // Interest
    const intDate = new Date(d.getFullYear(), d.getMonth(), 28);
    if (intDate <= today)
      txns.push({
        id: String(id++),
        date: iso(intDate),
        accountId: "a2",
        amount: 145 + rand() * 30,
        kind: "income",
        category: "Interest",
        merchant: "Ally Bank",
        recurring: true,
      });
    // Random daily expenses
    const merchants: [string, string, number][] = [
      ["Whole Foods", "Groceries", 85],
      ["Trader Joe's", "Groceries", 65],
      ["Uber", "Transport", 22],
      ["Shell", "Transport", 48],
      ["Chipotle", "Dining", 14],
      ["Sweetgreen", "Dining", 16],
      ["Amazon", "Shopping", 45],
      ["Apple", "Shopping", 120],
      ["AMC", "Entertainment", 28],
      ["Delta", "Travel", 320],
      ["CVS", "Health", 24],
      ["Blue Cross", "Insurance", 380],
    ];
    const n = 18 + Math.floor(rand() * 8);
    for (let i = 0; i < n; i++) {
      const [merchant, cat, base] = merchants[Math.floor(rand() * merchants.length)];
      const day = 1 + Math.floor(rand() * 28);
      const dt = new Date(d.getFullYear(), d.getMonth(), day);
      if (dt > today) continue;
      const amt = -(base * (0.6 + rand() * 1.1));
      txns.push({
        id: String(id++),
        date: iso(dt),
        accountId: rand() > 0.4 ? "a6" : "a1",
        amount: Math.round(amt * 100) / 100,
        kind: "expense",
        category: cat,
        merchant,
      });
    }
    // Occasional dividend income
    if (rand() > 0.4) {
      const dd = new Date(d.getFullYear(), d.getMonth(), 20);
      if (dd <= today)
        txns.push({
          id: String(id++),
          date: iso(dd),
          accountId: "a4",
          amount: 180 + rand() * 220,
          kind: "income",
          category: "Dividends",
          merchant: "VTI Distribution",
        });
    }
  }
  return txns.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export const transactions = generateTransactions();

function generatePriceHistory(base: number, vol: number, days = 180): { date: string; price: number }[] {
  const out: { date: string; price: number }[] = [];
  const today = new Date();
  let p = base * 0.85;
  for (let i = days; i >= 0; i--) {
    p = p * (1 + (rand() - 0.48) * vol);
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push({ date: iso(d), price: Math.round(p * 100) / 100 });
  }
  // ensure last price ≈ base
  const scale = base / out[out.length - 1].price;
  return out.map((x) => ({ date: x.date, price: Math.round(x.price * scale * 100) / 100 }));
}

export const holdings: Holding[] = [
  { id: "h1", symbol: "VTI", name: "Vanguard Total Stock Market ETF", assetClass: "etf", shares: 220, avgCost: 195.2, price: 268.4, dayChangePct: 0.62, sector: "Diversified", history: generatePriceHistory(268.4, 0.012) },
  { id: "h2", symbol: "VXUS", name: "Vanguard Total International Stock ETF", assetClass: "etf", shares: 180, avgCost: 55.1, price: 63.75, dayChangePct: -0.31, sector: "International", history: generatePriceHistory(63.75, 0.011) },
  { id: "h3", symbol: "AAPL", name: "Apple Inc.", assetClass: "stock", shares: 60, avgCost: 148.3, price: 224.5, dayChangePct: 1.15, sector: "Technology", history: generatePriceHistory(224.5, 0.018) },
  { id: "h4", symbol: "MSFT", name: "Microsoft Corp.", assetClass: "stock", shares: 40, avgCost: 268.1, price: 428.9, dayChangePct: 0.84, sector: "Technology", history: generatePriceHistory(428.9, 0.017) },
  { id: "h5", symbol: "NVDA", name: "NVIDIA Corp.", assetClass: "stock", shares: 25, avgCost: 320.0, price: 890.2, dayChangePct: 2.4, sector: "Technology", history: generatePriceHistory(890.2, 0.028) },
  { id: "h6", symbol: "BND", name: "Vanguard Total Bond Market ETF", assetClass: "etf", shares: 300, avgCost: 78.4, price: 74.2, dayChangePct: -0.08, sector: "Bonds", history: generatePriceHistory(74.2, 0.004) },
  { id: "h7", symbol: "GLD", name: "SPDR Gold Shares", assetClass: "commodity", shares: 30, avgCost: 178.0, price: 218.6, dayChangePct: 0.42, sector: "Commodities", history: generatePriceHistory(218.6, 0.01) },
  { id: "h8", symbol: "BTC", name: "Bitcoin", assetClass: "crypto", shares: 0.35, avgCost: 38000, price: 68420, dayChangePct: 1.8, sector: "Crypto", history: generatePriceHistory(68420, 0.032) },
];

export const trades: Trade[] = [
  { id: "t1", date: "2024-08-15", symbol: "VTI", side: "buy", shares: 20, price: 245.1, fees: 0, accountId: "a4" },
  { id: "t2", date: "2024-09-02", symbol: "AAPL", side: "buy", shares: 10, price: 210.4, fees: 0, accountId: "a4" },
  { id: "t3", date: "2024-10-11", symbol: "NVDA", side: "buy", shares: 5, price: 720.0, fees: 0, accountId: "a4" },
  { id: "t4", date: "2024-11-20", symbol: "MSFT", side: "sell", shares: 5, price: 415.6, fees: 0, accountId: "a4" },
  { id: "t5", date: "2025-01-14", symbol: "GLD", side: "buy", shares: 5, price: 205.0, fees: 0, accountId: "a4" },
  { id: "t6", date: "2025-03-05", symbol: "BND", side: "buy", shares: 50, price: 73.2, fees: 0, accountId: "a5" },
];

export const budgets: Budget[] = [
  { id: "b1", category: "Groceries", limit: 700, spent: 512 },
  { id: "b2", category: "Dining", limit: 400, spent: 386 },
  { id: "b3", category: "Transport", limit: 300, spent: 218 },
  { id: "b4", category: "Entertainment", limit: 200, spent: 132 },
  { id: "b5", category: "Shopping", limit: 500, spent: 612 },
  { id: "b6", category: "Subscriptions", limit: 120, spent: 95 },
  { id: "b7", category: "Utilities", limit: 250, spent: 189 },
  { id: "b8", category: "Health", limit: 200, spent: 84 },
];

export const goals: Goal[] = [
  { id: "g1", name: "Emergency Fund", target: 30000, current: 22000, deadline: "2026-06-30", monthlyContribution: 800 },
  { id: "g2", name: "House Down Payment", target: 100000, current: 42500, deadline: "2028-01-01", monthlyContribution: 1500 },
  { id: "g3", name: "Vacation — Japan", target: 8000, current: 5200, deadline: "2026-04-01", monthlyContribution: 400 },
  { id: "g4", name: "New Car", target: 25000, current: 6800, deadline: "2027-09-01", monthlyContribution: 550 },
  { id: "g5", name: "Retirement (Yearly)", target: 23000, current: 15400, deadline: "2026-12-31", monthlyContribution: 1200 },
];

export const dividends: Dividend[] = Array.from({ length: 24 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  d.setDate(15);
  return {
    id: `d${i}`,
    date: iso(d),
    symbol: ["VTI", "VXUS", "AAPL", "MSFT"][i % 4],
    amount: Math.round((80 + rand() * 260) * 100) / 100,
  };
});

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

export function netWorthSeries() {
  // build synthetic history by walking backwards from current net worth
  const nw = netWorth();
  const months = 24;
  const out: { month: string; value: number }[] = [];
  let cur = nw;
  const growth = 0.014;
  for (let i = 0; i < months; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    out.push({ month: d.toISOString().slice(0, 7), value: Math.round(cur) });
    cur = cur / (1 + growth + (rand() - 0.5) * 0.02);
  }
  return out.reverse();
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
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}
export function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
