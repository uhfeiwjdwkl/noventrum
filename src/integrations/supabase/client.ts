import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookieStorage } from "./cookieStorage";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://zgbodpdoflhephyyzhex.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const STORAGE_KEY = "sb-zgbodpdoflhephyyzhex-auth-token";

// One-time migration: promote existing localStorage session into the shared cookie.
if (typeof window !== "undefined" && window.location.hostname.endsWith("kommenszlapf.website")) {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing && !document.cookie.includes(`${STORAGE_KEY}=`)) {
    cookieStorage.setItem(STORAGE_KEY, existing);
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY || "public-anon-key-placeholder", {
  auth: {
    storage: cookieStorage as never,
    storageKey: STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
