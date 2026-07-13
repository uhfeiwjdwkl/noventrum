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
import { getQuotes, getHistory, getFxRates } from "@/lib/prices.functions";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

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
  settings: Settings;

  addAccount: (a: Omit<Account, "id">) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  addTransaction: (t: Omit<Transaction, "id">) => Transaction;
  deleteTransaction: (id: string) => void;

  addHolding: (h: Omit<Holding, "id" | "history">) => Holding;
  updateHolding: (id: string, patch: Partial<Holding>) => void;
  deleteHolding: (id: string) => void;

  /** Buy/sell any tradable asset. Updates the Holding, records the Trade,
   *  and posts a Transaction against the linked brokerage account. */
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
  }) => void;

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
  fxRates: { __base: "USD", USD: 1 } as Record<string, number> & { __base?: string },
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
        const holding: Holding = { ...h, id: uid(), history: [] };
        set((s) => ({ holdings: [...s.holdings, holding] }));
        return holding;
      },
      updateHolding: (id, patch) =>
        set((s) => ({
          holdings: s.holdings.map((h) => (h.id === id ? { ...h, ...patch } : h)),
        })),
      deleteHolding: (id) =>
        set((s) => ({ holdings: s.holdings.filter((h) => h.id !== id) })),

      recordTrade: (t) => {
        const sym = t.symbol.toUpperCase();
        set((s) => {
          // update or create holding
          const existing = s.holdings.find((h) => h.symbol === sym);
          let holdings: Holding[];
          if (existing) {
            if (t.side === "buy") {
              const newShares = existing.shares + t.shares;
              const newCost =
                (existing.shares * existing.avgCost + t.shares * t.price + t.fees + (t.tax ?? 0)) /
                (newShares || 1);
              holdings = s.holdings.map((h) =>
                h.id === existing.id ? { ...h, shares: newShares, avgCost: newCost, price: t.price } : h,
              );
            } else {
              const newShares = Math.max(0, existing.shares - t.shares);
              holdings = s.holdings.map((h) =>
                h.id === existing.id ? { ...h, shares: newShares, price: t.price } : h,
              );
            }
          } else if (t.side === "buy") {
            holdings = [
              ...s.holdings,
              {
                id: uid(),
                symbol: sym,
                name: t.name ?? sym,
                assetClass: t.assetClass ?? "stock",
                shares: t.shares,
                avgCost: (t.shares * t.price + t.fees + (t.tax ?? 0)) / (t.shares || 1),
                price: t.price,
                dayChangePct: 0,
                currency: t.currency,
                history: [],
              },
            ];
          } else {
            holdings = s.holdings;
          }

          // record the trade
          const trade: Trade = {
            id: uid(),
            date: t.date,
            symbol: sym,
            side: t.side,
            shares: t.shares,
            price: t.price,
            fees: t.fees,
            tax: t.tax,
            accountId: t.accountId,
            currency: t.currency,
          };

          // post as transaction against the brokerage account
          const cashDelta =
            t.side === "buy"
              ? -(t.shares * t.price + t.fees + (t.tax ?? 0))
              : t.shares * t.price - t.fees - (t.tax ?? 0);
          const txn: Transaction = {
            id: uid(),
            date: t.date,
            accountId: t.accountId,
            amount: cashDelta,
            kind: "trade",
            category: t.side === "buy" ? "Buy" : "Sell",
            merchant: sym,
            notes: `${t.side.toUpperCase()} ${t.shares} @ ${t.price}` +
              (t.fees ? ` fees ${t.fees}` : "") +
              (t.tax ? ` tax ${t.tax}` : ""),
            currency: t.currency,
          };
          const accounts = s.accounts.map((a) =>
            a.id === t.accountId ? { ...a, balance: a.balance + cashDelta } : a,
          );
          return {
            holdings,
            trades: [trade, ...s.trades],
            transactions: [txn, ...s.transactions].sort((a, b) => (a.date < b.date ? 1 : -1)),
            accounts,
          };
        });
      },

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
            transactions = [
              {
                id: uid(),
                date: d.date,
                accountId: d.accountId,
                amount: net,
                kind: "income",
                category: "Dividend",
                merchant: d.symbol,
                notes: d.tax ? `dividend ${d.amount}, tax ${d.tax}` : undefined,
                currency: d.currency,
              },
              ...s.transactions,
            ].sort((a, b) => (a.date < b.date ? 1 : -1));
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
      version: 2,
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
  void useFinance.persist.rehydrate();
}
