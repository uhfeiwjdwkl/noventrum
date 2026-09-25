import { kommenszlapf as supabase } from "@/integrations/supabase/kommenszlapf";
import { useFinance } from "@/lib/finance/store";
import { deriveHoldings, setDisplayCurrency } from "@/lib/finance/data";

/**
 * Cloud storage for Noventrum on the shared Kommenszlapf account.
 *
 * Noventrum owns exactly one table — noventrum_state(user_id pk, data jsonb) —
 * and only ever reads/writes the signed-in user's own row. Other Kommenszlapf
 * apps' tables (profiles, user_data, ...) are never touched.
 *
 * Only user-entered data is stored; quotes, price history and FX are re-fetched.
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

function hasData(s: Snapshot) {
  return ["accounts", "transactions", "trades"].some(
    (k) => Array.isArray(s[k]) && (s[k] as unknown[]).length > 0,
  );
}

let lastPushed = "";

export async function pushCloud(userId: string) {
  const data = snapshot();
  const json = JSON.stringify(data);
  if (json === lastPushed) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
  lastPushed = json;
}

/** Returns true when cloud data was loaded into the app. */
export async function pullCloud(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from(TABLE).select("data").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  const payload = (data as { data?: Snapshot } | null)?.data;
  if (!payload || !hasData(payload)) return false;
  const prev = useFinance.getState();
  const merged = { ...payload, settings: { ...prev.settings, ...(payload.settings as object) } } as never;
  useFinance.setState(merged);
  const s = useFinance.getState();
  useFinance.setState({ holdings: deriveHoldings(s.trades, [], s.assetMeta) });
  setDisplayCurrency(s.settings.baseCurrency);
  lastPushed = JSON.stringify(snapshot());
  void s.refreshFx();
  void s.refreshPrices();
  void s.refreshAllHistory();
  void s.refreshWatchlist();
  void s.refreshFxHistory();
  void s.backfillFxRates();
  return true;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let unsubscribe: (() => void) | undefined;
let session = 0;

/** Download first; only after that start debounce-uploading local changes. */
export function startCloudSync(userId: string) {
  stopCloudSync();
  const mine = ++session;
  void (async () => {
    try {
      const loaded = await pullCloud(userId);
      if (mine !== session) return;
      // First sign-in on this device with an empty cloud row: upload local data.
      if (!loaded && hasData(snapshot())) await pushCloud(userId);
    } catch (e) {
      console.warn("[noventrum] cloud pull failed; not uploading to avoid overwriting", e);
      return;
    }
    if (mine !== session) return;
    unsubscribe = useFinance.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void pushCloud(userId).catch((e) => console.warn("[noventrum] cloud push failed", e));
      }, 2000);
    });
  })();
}

export function stopCloudSync() {
  session++;
  if (timer) clearTimeout(timer);
  timer = undefined;
  unsubscribe?.();
  unsubscribe = undefined;
  lastPushed = "";
}
