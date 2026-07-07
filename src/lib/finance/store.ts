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
} from "./data";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export interface FinanceState {
  accounts: Account[];
  transactions: Transaction[];
  holdings: Holding[];
  trades: Trade[];
  budgets: Budget[];
  goals: Goal[];
  dividends: Dividend[];
  addAccount: (a: Omit<Account, "id">) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (t: Omit<Transaction, "id">) => Transaction;
  deleteTransaction: (id: string) => void;
  addHolding: (h: Omit<Holding, "id" | "history">) => Holding;
  deleteHolding: (id: string) => void;
  addBudget: (b: Omit<Budget, "id" | "spent"> & { spent?: number }) => Budget;
  deleteBudget: (id: string) => void;
  addGoal: (g: Omit<Goal, "id" | "current"> & { current?: number }) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
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
};

export const useFinance = create<FinanceState>()(
  persist(
    (set) => ({
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
          // If linked to an account, adjust its balance
          const accounts = s.accounts.map((a) =>
            a.id === t.accountId ? { ...a, balance: a.balance + t.amount } : a,
          );
          // If category matches a budget and it's an expense, add to spent
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
      deleteHolding: (id) =>
        set((s) => ({ holdings: s.holdings.filter((h) => h.id !== id) })),
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
      resetAll: () => set({ ...empty }),
    }),
    {
      name: "noventrum-store-v1",
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

// Call once on the client to load persisted data without breaking SSR hydration.
export function hydrateFinance() {
  if (typeof window === "undefined") return;
  void useFinance.persist.rehydrate();
}
