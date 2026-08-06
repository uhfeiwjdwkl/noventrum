import { supabase } from "@/integrations/supabase/client";
import { useFinance } from "@/lib/finance/store";

/**
 * Cloud storage for Noventrum.
 *
 * One row per signed-in user in the shared Kommenszlapf Supabase project:
 *   noventrum_state(user_id uuid pk, data jsonb, updated_at timestamptz)
 *
 * Only user-entered data is stored (the same slice the store persists locally).
 * Quotes, price history and FX rates are never uploaded — they are re-fetched.
 */
const TABLE = "noventrum_state";

type Snapshot = Record<string, unknown>;

function snapshot(): Snapshot {
  const s = useFinance.getState();
  return {
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
  };
}

export async function pushCloud(userId: string) {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, data: snapshot(), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function pullCloud(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from(TABLE).select("data").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  const payload = (data as { data?: Snapshot } | null)?.data;
  if (!payload) return false;
  useFinance.setState(payload as never);
  const s = useFinance.getState();
  void s.refreshFx();
  void s.refreshPrices();
  void s.refreshWatchlist();
  return true;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let unsubscribe: (() => void) | undefined;

/** Pull once, then debounce-push every local change while signed in. */
export function startCloudSync(userId: string) {
  stopCloudSync();
  void pullCloud(userId).catch(() => {});
  unsubscribe = useFinance.subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void pushCloud(userId).catch(() => {});
    }, 2000);
  });
}

export function stopCloudSync() {
  if (timer) clearTimeout(timer);
  unsubscribe?.();
  unsubscribe = undefined;
}
