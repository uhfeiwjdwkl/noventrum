import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Account,
  Transaction,
  Holding,
  Trade,
  Budget,
  Goal,
  Dividend,
  Property,
  PhysicalAsset,
  IncomeSource,
  RecurringRule,
  RecurUnit,
  WatchItem,
  FxHistory,
  FxMap,
} from "./data";
import { deriveHoldings, dueDates, setDisplayCurrency, type SymbolMeta } from "./data";
import {
  getQuotes,
  getHistory,
  getFxRates,
  getFxRatesAt,
} from "@/lib/prices.functions";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Cash movement a trade causes on its settlement account (asset currency). */
function tradeCash(t: Trade) {
  const extra = (t.fees || 0) + (t.tax ?? 0);
  return t.side === "buy" ? -(t.shares * t.price + extra) : t.shares * t.price - extra;
}

/** The cash transaction mirroring a trade. */
function tradeTxn(t: Trade, cashDelta: number): Transaction {
  return {
    id: uid(),
    date: t.date,
    accountId: t.accountId,
    amount: cashDelta,
    kind: "trade",
    category: t.side === "buy" ? "Buy" : "Sell",
    merchant: t.symbol,
    notes:
      `${t.side.toUpperCase()} ${t.shares} @ ${t.price}` +
      (t.fees ? ` fees ${t.fees}` : "") +
      (t.tax ? ` tax ${t.tax}` : ""),
    currency: t.currency,
    tradeId: t.id,
  };
}

export interface Settings {
  baseCurrency: string;
  /** currency codes offered in pickers (base + custom additions) */
  currencies: string[];
  /** show prices in the asset's own currency instead of the base one */
  displayNative: boolean;
}

export const DEFAULT_CURRENCIES = [
  "AUD",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "NZD",
  "CHF",
  "CNY",
  "SGD",
  "HKD",
  "INR",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "ZAR",
  "MXN",
  "BRL",
  "ARS",
  "CLP",
  "KRW",
  "TWD",
  "THB",
  "MYR",
  "IDR",
  "PHP",
  "VND",
  "AED",
  "SAR",
  "QAR",
  "ILS",
  "TRY",
  "RUB",
  "UAH",
  "EGP",
  "NGN",
  "KES",
];

export interface FinanceState {
  accounts: Account[];
  transactions: Transaction[];
  holdings: Holding[];
  trades: Trade[];
  budgets: Budget[];
  goals: Goal[];
  dividends: Dividend[];
  properties: Property[];
  physicalAssets: PhysicalAsset[];
  incomeSources: IncomeSource[];
  recurringRules: RecurringRule[];
  watchlist: WatchItem[];
  fxRates: FxMap;
  fxHistory: FxHistory;
  assetMeta: Record<string, SymbolMeta>;
  settings: Settings;
  /** set while the ledger is being re-based onto a new default currency */
  rebasing: boolean;

  addAccount: (a: Omit<Account, "id">) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  addTransaction: (t: Omit<Transaction, "id">) => Transaction;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  deleteTransaction: (id: string) => void;
  deleteTransactions: (ids: string[]) => void;
  bulkUpdateTransactions: (ids: string[], patch: Partial<Omit<Transaction, "id">>) => void;

  updateHolding: (id: string, patch: Partial<Holding>) => void;
  deleteHolding: (id: string) => void;

  /** Buy/sell any tradable asset. The trade ledger is the source of truth. */
  recordTrade: (t: {
    date: string;
    symbol: string;
    name?: string;
    assetClass?: Holding["assetClass"];
    side: "buy" | "sell";
    shares: number;
    price: number;
    fees: number;
    tax?: number;
    accountId: string;
    currency?: string;
    fxRate?: number;
    notes?: string;
  }) => void;
  updateTrade: (id: string, patch: Partial<Omit<Trade, "id">>) => void;
  deleteTrade: (id: string) => void;

  /** Exchange one currency for another between two accounts. */
  recordExchange: (x: {
    date: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    rate: number;
    fees?: number;
    notes?: string;
  }) => void;

  addBudget: (b: Omit<Budget, "id" | "spent"> & { spent?: number }) => Budget;
  deleteBudget: (id: string) => void;

  addGoal: (g: Omit<Goal, "id" | "current"> & { current?: number }) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;

  addDividend: (d: Omit<Dividend, "id">) => Dividend;
  deleteDividend: (id: string) => void;

  addProperty: (
    p: Omit<Property, "id" | "valuations" | "currentValue"> & {
      currentValue?: number;
      valuations?: Property["valuations"];
    },
  ) => Property;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  addPropertyValuation: (id: string, date: string, value: number) => void;
  deleteProperty: (id: string) => void;

  addPhysicalAsset: (
    a: Omit<PhysicalAsset, "id" | "currentValue"> & { currentValue?: number },
  ) => PhysicalAsset;
  updatePhysicalAsset: (id: string, patch: Partial<PhysicalAsset>) => void;
  deletePhysicalAsset: (id: string) => void;

  addIncomeSource: (s: Omit<IncomeSource, "id" | "active"> & { active?: boolean }) => IncomeSource;
  deleteIncomeSource: (id: string) => void;

  addRecurringRule: (
    r: Omit<RecurringRule, "id" | "active" | "lastRun">,
  ) => RecurringRule;
  cancelRecurringRule: (id: string) => void;
  deleteRecurringRule: (id: string) => void;
  /** Materialise every due occurrence into real transactions. */
  runRecurring: () => number;

  addWatch: (w: WatchItem) => void;
  removeWatch: (symbol: string) => void;
  refreshWatchlist: () => Promise<void>;

  refreshPrices: () => Promise<{ updated: number; failed: number }>;
  refreshHistory: (symbol: string) => Promise<number>;
  refreshAllHistory: () => Promise<number>;
  refreshFx: () => Promise<number>;
  refreshFxHistory: () => Promise<number>;
  /** Fill in missing trade-date FX rates so cost basis is correct in base. */
  backfillFxRates: () => Promise<number>;

  addCurrency: (code: string) => void;
  removeCurrency: (code: string) => void;
  setDisplayNative: (v: boolean) => void;
  setBaseCurrency: (c: string) => Promise<void>;

  resetAll: () => void;
}

const empty = {
  accounts: [] as Account[],
  transactions: [] as Transaction[],
  holdings: [] as Holding[],
  trades: [] as Trade[],
  budgets: [] as Budget[],
  goals: [] as Goal[],
  dividends: [] as Dividend[],
  properties: [] as Property[],
  physicalAssets: [] as PhysicalAsset[],
  incomeSources: [] as IncomeSource[],
  recurringRules: [] as RecurringRule[],
  watchlist: [] as WatchItem[],
  fxRates: { AUD: 1, __base: "AUD" } as unknown as FxMap,
  fxHistory: {} as FxHistory,
  assetMeta: {} as Record<string, SymbolMeta>,
  settings: {
    baseCurrency: "AUD",
    currencies: [...DEFAULT_CURRENCIES],
    displayNative: false,
  } as Settings,
  rebasing: false,
};

export const useFinance = create<FinanceState>()(
  persist(
    (set, get) => ({
      ...empty,

      /* ------------------------------ accounts ----------------------------- */
      addAccount: (a) => {
        const account: Account = { ...a, id: uid(), balanceDate: a.balanceDate ?? todayISO() };
        set((s) => ({ accounts: [...s.accounts, account] }));
        if (account.currency !== get().settings.baseCurrency) void get().refreshFx();
        return account;
      },
      updateAccount: (id, patch) =>
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === id
              ? { ...a, ...patch, balanceDate: patch.balance !== undefined ? todayISO() : a.balanceDate }
              : a,
          ),
        })),
      deleteAccount: (id) =>
        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
          transactions: s.transactions.filter((t) => t.accountId !== id),
        })),

      /* ---------------------------- transactions --------------------------- */
      addTransaction: (t) => {
        const txn: Transaction = { ...t, id: uid() };
        set((s) => {
          const budgets = s.budgets.map((b) =>
            t.kind === "expense" && b.category === t.category
              ? { ...b, spent: b.spent + Math.abs(t.amount) }
              : b,
          );
          return {
            transactions: [txn, ...s.transactions].sort((a, b) => (a.date < b.date ? 1 : -1)),
            budgets,
          };
        });
        return txn;
      },
      updateTransaction: (id, patch) =>
        set((s) => {
          const old = s.transactions.find((t) => t.id === id);
          if (!old) return {};
          const next: Transaction = { ...old, ...patch, id };
          return {
            transactions: s.transactions
              .map((t) => (t.id === id ? next : t))
              .sort((a, b) => (a.date < b.date ? 1 : -1)),
          };
        }),
      deleteTransaction: (id) => get().deleteTransactions([id]),
      deleteTransactions: (ids) =>
        set((s) => {
          const doomed = s.transactions.filter((t) => ids.includes(t.id));
          if (doomed.length === 0) return {};
          const budgets = s.budgets.map((b) => {
            const spent = doomed
              .filter((t) => t.kind === "expense" && t.category === b.category)
              .reduce((sum, t) => sum + Math.abs(t.amount), 0);
            return spent ? { ...b, spent: Math.max(0, b.spent - spent) } : b;
          });
          return {
            transactions: s.transactions.filter((t) => !ids.includes(t.id)),
            budgets,
          };
        }),
      bulkUpdateTransactions: (ids, patch) => {
        for (const id of ids) get().updateTransaction(id, patch);
      },

      /* ------------------------------ holdings ----------------------------- */
      updateHolding: (id, patch) =>
        set((s) => ({
          holdings: s.holdings.map((h) => (h.id === id ? { ...h, ...patch } : h)),
        })),
      /** Removes the position and every trade behind it. */
      deleteHolding: (id) =>
        set((s) => {
          const h = s.holdings.find((x) => x.id === id);
          if (!h) return {};
          const doomed = s.trades.filter((t) => t.symbol === h.symbol);
          const ids = new Set(doomed.map((t) => t.id));
          const trades = s.trades.filter((t) => !ids.has(t.id));
          return {
            trades,
            transactions: s.transactions.filter((t) => !(t.tradeId && ids.has(t.tradeId))),
            holdings: deriveHoldings(trades, s.holdings, s.assetMeta).filter(
              (x) => x.symbol !== h.symbol,
            ),
          };
        }),

      recordTrade: (t) => {
        const sym = t.symbol.toUpperCase();
        const base = get().settings.baseCurrency;
        const cur = t.currency ?? base;
        const trade: Trade = {
          id: uid(),
          date: t.date,
          symbol: sym,
          side: t.side,
          shares: t.shares,
          price: t.price,
          fees: t.fees || 0,
          tax: t.tax,
          accountId: t.accountId,
          currency: cur,
          name: t.name,
          assetClass: t.assetClass,
          notes: t.notes,
          fxRate: t.fxRate ?? (cur === base ? 1 : undefined),
          baseCurrency: base,
        };
        set((s) => {
          const assetMeta: Record<string, SymbolMeta> = {
            ...s.assetMeta,
            [sym]: {
              ...s.assetMeta[sym],
              name: t.name || s.assetMeta[sym]?.name,
              assetClass: t.assetClass ?? s.assetMeta[sym]?.assetClass,
              currency: cur ?? s.assetMeta[sym]?.currency,
            },
          };
          const trades = [trade, ...s.trades];
          const cashDelta = tradeCash(trade);
          const txn = tradeTxn(trade, cashDelta);
          return {
            assetMeta,
            trades,
            holdings: deriveHoldings(trades, s.holdings, assetMeta),
            transactions: t.accountId
              ? [txn, ...s.transactions].sort((a, b) => (a.date < b.date ? 1 : -1))
              : s.transactions,
          };
        });
        if (!trade.fxRate) void get().backfillFxRates();
      },

      /** Edit a logged trade (including backdating). Cash and holdings re-sync. */
      updateTrade: (id, patch) => {
        set((s) => {
          const old = s.trades.find((t) => t.id === id);
          if (!old) return {};
          const next: Trade = {
            ...old,
            ...patch,
            id: old.id,
            symbol: (patch.symbol ?? old.symbol).toUpperCase(),
          };
          // date or currency changed → the stored rate no longer applies
          if (
            (patch.date && patch.date !== old.date) ||
            (patch.currency && patch.currency !== old.currency)
          ) {
            next.fxRate =
              next.currency === s.settings.baseCurrency ? 1 : (patch.fxRate ?? undefined);
          }
          const trades = s.trades.map((t) => (t.id === id ? next : t));
          const newDelta = tradeCash(next);
          const transactions = s.transactions
            .map((t) => (t.tradeId === id ? { ...tradeTxn(next, newDelta), id: t.id } : t))
            .sort((a, b) => (a.date < b.date ? 1 : -1));
          return {
            trades,
            transactions,
            holdings: deriveHoldings(trades, s.holdings, s.assetMeta),
          };
        });
        void get().backfillFxRates();
      },

      deleteTrade: (id) =>
        set((s) => {
          const old = s.trades.find((t) => t.id === id);
          if (!old) return {};
          const trades = s.trades.filter((t) => t.id !== id);
          return {
            trades,
            transactions: s.transactions.filter((t) => t.tradeId !== id),
            holdings: deriveHoldings(trades, s.holdings, s.assetMeta),
          };
        }),

      /* ----------------------------- currency FX ---------------------------- */
      recordExchange: (x) => {
        const s0 = get();
        const from = s0.accounts.find((a) => a.id === x.fromAccountId);
        const to = s0.accounts.find((a) => a.id === x.toAccountId);
        if (!from || !to) return;
        const fees = x.fees || 0;
        const toAmount = (x.amount - fees) * x.rate;
        const trade: Trade = {
          id: uid(),
          date: x.date,
          symbol: `${from.currency}${to.currency}=X`,
          side: "buy",
          shares: toAmount,
          price: x.rate > 0 ? 1 / x.rate : 0,
          fees,
          accountId: x.fromAccountId,
          currency: from.currency,
          name: `${from.currency} → ${to.currency}`,
          assetClass: "forex",
          notes: x.notes,
          fxRate: from.currency === s0.settings.baseCurrency ? 1 : undefined,
          baseCurrency: s0.settings.baseCurrency,
          exchange: {
            toAccountId: x.toAccountId,
            toCurrency: to.currency,
            toAmount,
          },
        };
        const out: Transaction = {
          id: uid(),
          date: x.date,
          accountId: x.fromAccountId,
          amount: -x.amount,
          kind: "transfer",
          category: "Currency exchange",
          merchant: `${from.currency} → ${to.currency}`,
          notes: `rate ${x.rate}${fees ? ` fees ${fees}` : ""}`,
          currency: from.currency,
          tradeId: trade.id,
        };
        const inn: Transaction = {
          id: uid(),
          date: x.date,
          accountId: x.toAccountId,
          amount: toAmount,
          kind: "transfer",
          category: "Currency exchange",
          merchant: `${from.currency} → ${to.currency}`,
          notes: `rate ${x.rate}`,
          currency: to.currency,
          tradeId: trade.id,
        };
        set((s) => ({
          trades: [trade, ...s.trades],
          transactions: [out, inn, ...s.transactions].sort((a, b) => (a.date < b.date ? 1 : -1)),
        }));
        void get().refreshFx();
      },

      /* ------------------------------ budgets ------------------------------ */
      addBudget: (b) => {
        const budget: Budget = { ...b, id: uid(), spent: b.spent ?? 0 };
        set((s) => ({ budgets: [...s.budgets, budget] }));
        return budget;
      },
      deleteBudget: (id) => set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) })),

      addGoal: (g) => {
        const goal: Goal = { ...g, id: uid(), current: g.current ?? 0 };
        set((s) => ({ goals: [...s.goals, goal] }));
        return goal;
      },
      updateGoal: (id, patch) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      addDividend: (d) => {
        const div: Dividend = { ...d, id: uid() };
        set((s) => {
          let transactions = s.transactions;
          if (d.accountId) {
            const net = d.amount - (d.tax ?? 0);
            const divTxn: Transaction = {
              id: uid(),
              date: d.date,
              accountId: d.accountId,
              amount: net,
              kind: "income",
              category: "Dividend",
              merchant: d.symbol,
              notes: d.tax ? `dividend ${d.amount}, tax ${d.tax}` : undefined,
              currency: d.currency,
            };
            transactions = [divTxn, ...s.transactions].sort((a, b) => (a.date < b.date ? 1 : -1));
          }
          return { dividends: [div, ...s.dividends], transactions };
        });
        return div;
      },
      deleteDividend: (id) => set((s) => ({ dividends: s.dividends.filter((d) => d.id !== id) })),

      addProperty: (p) => {
        const prop: Property = {
          ...p,
          id: uid(),
          currentValue: p.currentValue ?? p.purchasePrice,
          valuations: p.valuations ?? [{ date: p.purchaseDate, value: p.purchasePrice }],
        };
        set((s) => ({ properties: [...s.properties, prop] }));
        return prop;
      },
      updateProperty: (id, patch) =>
        set((s) => ({
          properties: s.properties.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      addPropertyValuation: (id, date, value) =>
        set((s) => ({
          properties: s.properties.map((p) =>
            p.id === id
              ? {
                  ...p,
                  currentValue: value,
                  valuations: [...p.valuations, { date, value }].sort((a, b) =>
                    a.date < b.date ? -1 : 1,
                  ),
                }
              : p,
          ),
        })),
      deleteProperty: (id) =>
        set((s) => ({ properties: s.properties.filter((p) => p.id !== id) })),

      addPhysicalAsset: (a) => {
        const asset: PhysicalAsset = {
          ...a,
          id: uid(),
          currentValue: a.currentValue ?? a.purchasePrice,
        };
        set((s) => ({ physicalAssets: [...s.physicalAssets, asset] }));
        return asset;
      },
      updatePhysicalAsset: (id, patch) =>
        set((s) => ({
          physicalAssets: s.physicalAssets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      deletePhysicalAsset: (id) =>
        set((s) => ({ physicalAssets: s.physicalAssets.filter((a) => a.id !== id) })),

      addIncomeSource: (s) => {
        const src: IncomeSource = { ...s, id: uid(), active: s.active ?? true };
        set((st) => ({ incomeSources: [...st.incomeSources, src] }));
        return src;
      },
      deleteIncomeSource: (id) =>
        set((s) => ({ incomeSources: s.incomeSources.filter((x) => x.id !== id) })),

      /* ----------------------------- recurring ----------------------------- */
      addRecurringRule: (r) => {
        const rule: RecurringRule = { ...r, id: uid(), active: true };
        set((s) => ({ recurringRules: [...s.recurringRules, rule] }));
        get().runRecurring();
        return rule;
      },
      /** Stops future entries. Everything already logged stays put. */
      cancelRecurringRule: (id) =>
        set((s) => ({
          recurringRules: s.recurringRules.map((r) => (r.id === id ? { ...r, active: false } : r)),
        })),
      deleteRecurringRule: (id) =>
        set((s) => ({ recurringRules: s.recurringRules.filter((r) => r.id !== id) })),
      runRecurring: () => {
        const until = todayISO();
        let created = 0;
        for (const rule of get().recurringRules) {
          const dates = dueDates(rule, until);
          if (dates.length === 0) continue;
          for (const date of dates) {
            get().addTransaction({ ...rule.template, date, recurring: true, ruleId: rule.id });
            created++;
          }
          const last = dates[dates.length - 1];
          set((s) => ({
            recurringRules: s.recurringRules.map((r) =>
              r.id === rule.id ? { ...r, lastRun: last } : r,
            ),
          }));
        }
        return created;
      },

      /* ----------------------------- watchlist ----------------------------- */
      addWatch: (w) =>
        set((s) =>
          s.watchlist.some((x) => x.symbol === w.symbol)
            ? {}
            : { watchlist: [...s.watchlist, w] },
        ),
      removeWatch: (symbol) =>
        set((s) => ({ watchlist: s.watchlist.filter((w) => w.symbol !== symbol) })),
      refreshWatchlist: async () => {
        const symbols = get().watchlist.map((w) => w.symbol);
        if (symbols.length === 0) return;
        try {
          const quotes = await getQuotes({ data: { symbols } });
          set((s) => ({
            watchlist: s.watchlist.map((w) => {
              const q = quotes[w.symbol];
              return q
                ? {
                    ...w,
                    price: q.price,
                    dayChangePct: q.dayChangePct,
                    currency: q.currency,
                    name: w.name || q.name,
                  }
                : w;
            }),
          }));
        } catch {
          /* offline — keep cached values */
        }
      },

      /* ------------------------------- prices ------------------------------ */
      refreshPrices: async () => {
        const symbols = Array.from(new Set(get().holdings.map((h) => h.symbol))).filter(Boolean);
        if (symbols.length === 0) return { updated: 0, failed: 0 };
        try {
          const quotes = await getQuotes({ data: { symbols } });
          const now = new Date().toISOString();
          let updated = 0;
          set((s) => ({
            holdings: s.holdings.map((h) => {
              const q = quotes[h.symbol];
              if (!q) return h;
              updated++;
              return {
                ...h,
                price: q.price,
                dayChangePct: q.dayChangePct,
                currency: q.currency,
                name: h.name || q.name,
                priceUpdatedAt: now,
              };
            }),
          }));
          void get().refreshFx();
          return { updated, failed: symbols.length - updated };
        } catch {
          return { updated: 0, failed: symbols.length };
        }
      },
      refreshHistory: async (symbol) => {
        try {
          const { points } = await getHistory({
            data: { symbol, range: "5y", interval: "1mo" },
          });
          set((s) => ({
            holdings: s.holdings.map((h) =>
              h.symbol === symbol
                ? { ...h, history: points.map((p) => ({ date: p.date, price: p.close })) }
                : h,
            ),
          }));
          return points.length;
        } catch {
          return 0;
        }
      },
      refreshAllHistory: async () => {
        const symbols = Array.from(new Set(get().holdings.map((h) => h.symbol))).filter(Boolean);
        let n = 0;
        for (const sym of symbols) n += (await get().refreshHistory(sym)) > 0 ? 1 : 0;
        return n;
      },

      refreshFx: async () => {
        const base = get().settings.baseCurrency;
        const currencies = new Set<string>([base]);
        get().accounts.forEach((a) => currencies.add(a.currency));
        get().holdings.forEach((h) => h.currency && currencies.add(h.currency));
        get().properties.forEach((p) => currencies.add(p.currency));
        get().physicalAssets.forEach((a) => currencies.add(a.currency));
        get().trades.forEach((t) => t.currency && currencies.add(t.currency));
        const symbols = Array.from(currencies);
        try {
          const rates = await getFxRates({ data: { base, symbols } });
          set(() => ({ fxRates: { ...rates, [base]: 1, __base: base } as unknown as FxMap }));
          return Object.keys(rates).length;
        } catch {
          return 0;
        }
      },

      refreshFxHistory: async () => {
        const base = get().settings.baseCurrency;
        const currencies = new Set<string>();
        get().holdings.forEach((h) => h.currency && h.currency !== base && currencies.add(h.currency));
        get().accounts.forEach((a) => a.currency !== base && currencies.add(a.currency));
        let n = 0;
        for (const cur of currencies) {
          try {
            const { points } = await getHistory({
              data: { symbol: `${cur}${base}=X`, range: "5y", interval: "1mo" },
            });
            if (points.length === 0) continue;
            const add: FxHistory = {};
            for (const p of points) add[`${cur}:${p.date.slice(0, 7)}`] = p.close;
            set((s) => ({ fxHistory: { ...s.fxHistory, ...add } }));
            n++;
          } catch {
            /* keep going */
          }
        }
        return n;
      },

      backfillFxRates: async () => {
        const base = get().settings.baseCurrency;
        const missing = get().trades.filter(
          (t) => !t.fxRate || t.baseCurrency !== base,
        );
        if (missing.length === 0) return 0;
        const pairs = missing
          .filter((t) => (t.currency ?? base) !== base)
          .map((t) => ({ from: t.currency ?? base, date: t.date }));
        let rates: Record<string, number> = {};
        if (pairs.length > 0) {
          try {
            rates = await getFxRatesAt({ data: { to: base, pairs } });
          } catch {
            rates = {};
          }
        }
        let applied = 0;
        set((s) => {
          const trades = s.trades.map((t) => {
            if (t.fxRate && t.baseCurrency === base) return t;
            const cur = t.currency ?? base;
            const rate = cur === base ? 1 : rates[`${cur}:${t.date}`];
            if (!rate) return t;
            applied++;
            return { ...t, fxRate: rate, baseCurrency: base };
          });
          return { trades, holdings: deriveHoldings(trades, s.holdings, s.assetMeta) };
        });
        return applied;
      },

      /* ------------------------------ settings ----------------------------- */
      addCurrency: (code) => {
        const c = code.trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(c)) return;
        set((s) =>
          s.settings.currencies.includes(c)
            ? {}
            : { settings: { ...s.settings, currencies: [...s.settings.currencies, c] } },
        );
        void get().refreshFx();
      },
      removeCurrency: (code) =>
        set((s) => ({
          settings: {
            ...s.settings,
            currencies: s.settings.currencies.filter(
              (c) => c !== code || c === s.settings.baseCurrency,
            ),
          },
        })),
      setDisplayNative: (v) =>
        set((s) => ({ settings: { ...s.settings, displayNative: v } })),

      /**
       * Re-base everything onto a new default currency. Every trade's stored
       * rate is invalidated and re-fetched for its own date, so historical
       * cost basis and realized P/L stay accurate.
       */
      setBaseCurrency: async (c) => {
        const base = c.trim().toUpperCase();
        if (!base || base === get().settings.baseCurrency) return;
        setDisplayCurrency(base);
        set((s) => ({
          rebasing: true,
          settings: {
            ...s.settings,
            baseCurrency: base,
            currencies: s.settings.currencies.includes(base)
              ? s.settings.currencies
              : [...s.settings.currencies, base],
          },
          fxRates: { [base]: 1, __base: base } as unknown as FxMap,
          fxHistory: {},
          trades: s.trades.map((t) => ({
            ...t,
            baseCurrency: base,
            fxRate: (t.currency ?? base) === base ? 1 : undefined,
          })),
        }));
        try {
          await get().refreshFx();
          await get().backfillFxRates();
          await get().refreshFxHistory();
        } finally {
          set(() => ({ rebasing: false }));
        }
      },

      resetAll: () => set({ ...empty }),
    }),
    {
      name: "noventrum-store-v2",
      version: 4,
      migrate: (persisted, version) => {
        const s = persisted as Partial<FinanceState>;
        let trades = [...(s.trades ?? [])];
        let assetMeta: Record<string, SymbolMeta> = { ...(s.assetMeta ?? {}) };

        if (version < 3) {
          for (const h of s.holdings ?? []) {
            assetMeta[h.symbol] = {
              name: h.name,
              assetClass: h.assetClass,
              currency: h.currency,
              sector: h.sector,
            };
            const logged = trades
              .filter((t) => t.symbol === h.symbol)
              .reduce((sum, t) => sum + (t.side === "buy" ? t.shares : -t.shares), 0);
            const missing = Math.round((h.shares - logged) * 1e8) / 1e8;
            if (missing > 0) {
              trades.push({
                id: `legacy-${h.symbol}`,
                date: "2000-01-01",
                symbol: h.symbol,
                side: "buy",
                shares: missing,
                price: h.avgCost || h.price,
                fees: 0,
                accountId: "",
                currency: h.currency,
                name: h.name,
                assetClass: h.assetClass,
                notes: "imported opening position",
              });
            }
          }
        }

        if (version < 4) {
          const base = s.settings?.baseCurrency ?? "AUD";
          trades = trades.map((t) => ({
            ...t,
            baseCurrency: base,
            fxRate: t.fxRate ?? ((t.currency ?? base) === base ? 1 : undefined),
          }));
          assetMeta = { ...assetMeta };
          return {
            ...s,
            trades,
            assetMeta,
            recurringRules: s.recurringRules ?? [],
            watchlist: s.watchlist ?? [],
            fxHistory: s.fxHistory ?? {},
            rebasing: false,
            settings: {
              baseCurrency: base,
              currencies: s.settings?.currencies ?? [...DEFAULT_CURRENCIES],
              displayNative: s.settings?.displayNative ?? false,
            },
            holdings: deriveHoldings(trades, s.holdings ?? [], assetMeta),
          } as FinanceState;
        }

        return { ...s, trades, assetMeta } as FinanceState;
      },
      /**
       * Persist ONLY user-entered data. Anything re-fetchable (quotes, price
       * history, FX rates) is left out and re-fetched on load.
       */
      partialize: (s) => ({
        accounts: s.accounts,
        transactions: s.transactions,
        trades: s.trades,
        budgets: s.budgets,
        goals: s.goals,
        dividends: s.dividends,
        properties: s.properties,
        physicalAssets: s.physicalAssets,
        incomeSources: s.incomeSources,
        recurringRules: s.recurringRules,
        watchlist: s.watchlist.map((w) => ({ symbol: w.symbol, name: w.name })),
        assetMeta: s.assetMeta,
        settings: s.settings,
      }) as unknown as FinanceState,
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
          : window.localStorage,
      ),
      skipHydration: true,
    },
  ),
);

export function hydrateFinance() {
  if (typeof window === "undefined") return;
  void useFinance.persist.rehydrate()?.then?.(() => {
    const s = useFinance.getState();
    // Holdings are derived from the trade ledger, never persisted.
    useFinance.setState({ holdings: deriveHoldings(s.trades, [], s.assetMeta) });
    setDisplayCurrency(s.settings.baseCurrency);
    s.runRecurring();
    void s.refreshFx();
    void s.refreshWatchlist();
    if (s.holdings.length === 0 && s.trades.length === 0) return;
    void s.refreshPrices();
    void s.refreshAllHistory();
    void s.backfillFxRates();
    void s.refreshFxHistory();
  });
}
