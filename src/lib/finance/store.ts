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
} from "./data";
import { deriveHoldings, type SymbolMeta } from "./data";
import { getQuotes, getHistory, getFxRates } from "@/lib/prices.functions";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
/** Cash movement a trade causes on its settlement account. */
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
}

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
  fxRates: Record<string, number> & { __base?: string };
  /** per-symbol display info kept alongside the ledger */
  assetMeta: Record<string, SymbolMeta>;
  settings: Settings;

  addAccount: (a: Omit<Account, "id">) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  addTransaction: (t: Omit<Transaction, "id">) => Transaction;
  deleteTransaction: (id: string) => void;

  /** Deprecated manual entry — recorded as an opening buy trade. */
  addHolding: (h: Omit<Holding, "id" | "history"> & { accountId?: string; date?: string }) => void;
  updateHolding: (id: string, patch: Partial<Holding>) => void;
  deleteHolding: (id: string) => void;

  /** Buy/sell any tradable asset. The trade ledger is the source of truth —
   *  holdings, cost basis and realized P/L are recomputed from it. */
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
    notes?: string;
  }) => void;
  updateTrade: (id: string, patch: Partial<Omit<Trade, "id">>) => void;
  deleteTrade: (id: string) => void;


  addBudget: (b: Omit<Budget, "id" | "spent"> & { spent?: number }) => Budget;
  deleteBudget: (id: string) => void;

  addGoal: (g: Omit<Goal, "id" | "current"> & { current?: number }) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;

  addDividend: (d: Omit<Dividend, "id">) => Dividend;
  deleteDividend: (id: string) => void;

  addProperty: (p: Omit<Property, "id" | "valuations" | "currentValue"> & {
    currentValue?: number;
    valuations?: Property["valuations"];
  }) => Property;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  addPropertyValuation: (id: string, date: string, value: number) => void;
  deleteProperty: (id: string) => void;

  addPhysicalAsset: (a: Omit<PhysicalAsset, "id" | "currentValue"> & { currentValue?: number }) => PhysicalAsset;
  updatePhysicalAsset: (id: string, patch: Partial<PhysicalAsset>) => void;
  deletePhysicalAsset: (id: string) => void;

  addIncomeSource: (s: Omit<IncomeSource, "id" | "active"> & { active?: boolean }) => IncomeSource;
  deleteIncomeSource: (id: string) => void;

  refreshPrices: () => Promise<{ updated: number; failed: number }>;
  refreshHistory: (symbol: string) => Promise<number>;
  refreshFx: () => Promise<number>;
  setBaseCurrency: (c: string) => void;

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
  fxRates: { USD: 1, __base: "USD" as string } as unknown as Record<string, number> & { __base?: string },
  assetMeta: {} as Record<string, SymbolMeta>,
  settings: { baseCurrency: "USD" } as Settings,
};

export const useFinance = create<FinanceState>()(
  persist(
    (set, get) => ({
      ...empty,
      addAccount: (a) => {
        const account: Account = { ...a, id: uid() };
        set((s) => ({ accounts: [...s.accounts, account] }));
        return account;
      },
      updateAccount: (id, patch) =>
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      deleteAccount: (id) =>
        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
          transactions: s.transactions.filter((t) => t.accountId !== id),
        })),
      addTransaction: (t) => {
        const txn: Transaction = { ...t, id: uid() };
        set((s) => {
          const accounts = s.accounts.map((a) =>
            a.id === t.accountId ? { ...a, balance: a.balance + t.amount } : a,
          );
          const budgets = s.budgets.map((b) =>
            t.kind === "expense" && b.category === t.category
              ? { ...b, spent: b.spent + Math.abs(t.amount) }
              : b,
          );
          return {
            transactions: [txn, ...s.transactions].sort((a, b) =>
              a.date < b.date ? 1 : -1,
            ),
            accounts,
            budgets,
          };
        });
        return txn;
      },
      deleteTransaction: (id) =>
        set((s) => {
          const t = s.transactions.find((x) => x.id === id);
          if (!t) return {};
          const accounts = s.accounts.map((a) =>
            a.id === t.accountId ? { ...a, balance: a.balance - t.amount } : a,
          );
          const budgets = s.budgets.map((b) =>
            t.kind === "expense" && b.category === t.category
              ? { ...b, spent: Math.max(0, b.spent - Math.abs(t.amount)) }
              : b,
          );
          return {
            transactions: s.transactions.filter((x) => x.id !== id),
            accounts,
            budgets,
          };
        }),
      addHolding: (h) => {
        const account =
          h.accountId ||
          get().accounts.find((a) => a.type === "brokerage" || a.type === "cash")?.id ||
          "";
        get().recordTrade({
          date: h.date ?? new Date().toISOString().slice(0, 10),
          symbol: h.symbol,
          name: h.name,
          assetClass: h.assetClass,
          side: "buy",
          shares: h.shares,
          price: h.avgCost || h.price,
          fees: 0,
          accountId: account,
          currency: h.currency,
          notes: "opening position",
        });
      },
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
          const accounts = s.accounts.map((a) => {
            const delta = s.transactions
              .filter((t) => t.tradeId && ids.has(t.tradeId) && t.accountId === a.id)
              .reduce((sum, t) => sum + t.amount, 0);
            return delta ? { ...a, balance: a.balance - delta } : a;
          });
          const trades = s.trades.filter((t) => !ids.has(t.id));
          return {
            trades,
            accounts,
            transactions: s.transactions.filter((t) => !(t.tradeId && ids.has(t.tradeId))),
            holdings: deriveHoldings(trades, s.holdings, s.assetMeta).filter((x) => x.symbol !== h.symbol),
          };
        }),

      recordTrade: (t) => {
        const sym = t.symbol.toUpperCase();
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
          currency: t.currency,
          name: t.name,
          assetClass: t.assetClass,
          notes: t.notes,
        };
        set((s) => {
          const assetMeta: Record<string, SymbolMeta> = {
            ...s.assetMeta,
            [sym]: {
              ...s.assetMeta[sym],
              name: t.name || s.assetMeta[sym]?.name,
              assetClass: t.assetClass ?? s.assetMeta[sym]?.assetClass,
              currency: t.currency ?? s.assetMeta[sym]?.currency,
            },
          };
          const trades = [trade, ...s.trades];
          const cashDelta = tradeCash(trade);
          const txn = tradeTxn(trade, cashDelta);
          const accounts = t.accountId
            ? s.accounts.map((a) => (a.id === t.accountId ? { ...a, balance: a.balance + cashDelta } : a))
            : s.accounts;
          return {
            assetMeta,
            trades,
            holdings: deriveHoldings(trades, s.holdings, assetMeta),
            transactions: t.accountId
              ? [txn, ...s.transactions].sort((a, b) => (a.date < b.date ? 1 : -1))
              : s.transactions,
            accounts,
          };
        });
      },

      /** Edit a logged trade (including backdating). Cash and holdings re-sync. */
      updateTrade: (id, patch) =>
        set((s) => {
          const old = s.trades.find((t) => t.id === id);
          if (!old) return {};
          const next: Trade = { ...old, ...patch, id: old.id, symbol: (patch.symbol ?? old.symbol).toUpperCase() };
          const trades = s.trades.map((t) => (t.id === id ? next : t));
          const oldDelta = tradeCash(old);
          const newDelta = tradeCash(next);
          const accounts = s.accounts.map((a) => {
            let bal = a.balance;
            if (a.id === old.accountId) bal -= oldDelta;
            if (a.id === next.accountId) bal += newDelta;
            return bal === a.balance ? a : { ...a, balance: bal };
          });
          const transactions = s.transactions
            .map((t) => (t.tradeId === id ? { ...tradeTxn(next, newDelta), id: t.id } : t))
            .sort((a, b) => (a.date < b.date ? 1 : -1));
          return {
            trades,
            accounts,
            transactions,
            holdings: deriveHoldings(trades, s.holdings, s.assetMeta),
          };
        }),

      deleteTrade: (id) =>
        set((s) => {
          const old = s.trades.find((t) => t.id === id);
          if (!old) return {};
          const delta = tradeCash(old);
          const trades = s.trades.filter((t) => t.id !== id);
          return {
            trades,
            accounts: s.accounts.map((a) =>
              a.id === old.accountId ? { ...a, balance: a.balance - delta } : a,
            ),
            transactions: s.transactions.filter((t) => t.tradeId !== id),
            holdings: deriveHoldings(trades, s.holdings, s.assetMeta),
          };
        }),


      addBudget: (b) => {
        const budget: Budget = { ...b, id: uid(), spent: b.spent ?? 0 };
        set((s) => ({ budgets: [...s.budgets, budget] }));
        return budget;
      },
      deleteBudget: (id) =>
        set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) })),

      addGoal: (g) => {
        const goal: Goal = { ...g, id: uid(), current: g.current ?? 0 };
        set((s) => ({ goals: [...s.goals, goal] }));
        return goal;
      },
      updateGoal: (id, patch) =>
        set((s) => ({
          goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        })),
      deleteGoal: (id) =>
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      addDividend: (d) => {
        const div: Dividend = { ...d, id: uid() };
        set((s) => {
          // optionally post cash income to linked account
          let accounts = s.accounts;
          let transactions = s.transactions;
          if (d.accountId) {
            const net = d.amount - (d.tax ?? 0);
            accounts = s.accounts.map((a) =>
              a.id === d.accountId ? { ...a, balance: a.balance + net } : a,
            );
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
          return { dividends: [div, ...s.dividends], accounts, transactions };
        });
        return div;
      },
      deleteDividend: (id) =>
        set((s) => ({ dividends: s.dividends.filter((d) => d.id !== id) })),

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
        const asset: PhysicalAsset = { ...a, id: uid(), currentValue: a.currentValue ?? a.purchasePrice };
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
          return { updated, failed: symbols.length - updated };
        } catch {
          return { updated: 0, failed: symbols.length };
        }
      },
      refreshHistory: async (symbol) => {
        try {
          const { points } = await getHistory({ data: { symbol, range: "5y", interval: "1mo" } });
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
        const symbols = Array.from(currencies);
        try {
          const rates = await getFxRates({ data: { base, symbols } });
          set(() => ({ fxRates: { ...rates, __base: base } as Record<string, number> & { __base?: string } }));
          return Object.keys(rates).length;
        } catch {
          return 0;
        }
      },
      setBaseCurrency: (c) => {
        set((s) => ({ settings: { ...s.settings, baseCurrency: c } }));
        void get().refreshFx();
      },

      resetAll: () => set({ ...empty }),
    }),
    {
      name: "noventrum-store-v2",
      version: 3,
      migrate: (persisted, version) => {
        const s = persisted as Partial<FinanceState>;
        if (version < 3) {
          // v2 kept hand-entered holdings. Convert them into opening buy
          // trades so the ledger becomes the single source of truth.
          const trades = [...(s.trades ?? [])];
          const assetMeta: Record<string, SymbolMeta> = { ...(s.assetMeta ?? {}) };
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
          return {
            ...s,
            assetMeta,
            trades,
            holdings: deriveHoldings(trades, s.holdings ?? [], assetMeta),
          } as FinanceState;
        }
        return persisted as FinanceState;
      },
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
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
    if (s.holdings.length === 0) return;
    // live prices + historical closes power current and past valuations
    void s.refreshPrices();
    void s.refreshAllHistory();
    void s.refreshFx();
  });
}

