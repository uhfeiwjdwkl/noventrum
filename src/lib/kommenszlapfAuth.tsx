import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type KommenszlapfProfile = {
  user_id: string;
  username: string | null;
  email: string | null;
};

type SignInArgs = { identifier: string; password: string };
type SignUpArgs = { username: string; email: string; password: string };

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: KommenszlapfProfile | null;
  loading: boolean;
  signIn: (args: SignInArgs) => Promise<{ error: string | null }>;
  signUp: (args: SignUpArgs) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function KommenszlapfAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<KommenszlapfProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("kommenszlapf_profiles")
      .select("user_id, username, email")
      .eq("user_id", uid)
      .maybeSingle();
    if (data) setProfile(data as KommenszlapfProfile);
  }, []);

  useEffect(() => {
    // 1. Register listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => {
          fetchProfile(sess.user.id);
        }, 0);
      } else {
        setProfile(null);
      }
    });
    // 2. Then check for existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) fetchProfile(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn: AuthContextValue["signIn"] = async ({ identifier, password }) => {
    if (identifier.includes("@")) {
      const { error } = await supabase.auth.signInWithPassword({ email: identifier, password });
      return { error: error?.message ?? null };
    }
    const { data, error } = await supabase.functions.invoke("lookup-email-by-username", {
      body: { username: identifier, password },
    });
    if (error) return { error: error.message };
    if (!data?.access_token || !data?.refresh_token)
      return { error: "Invalid username or password" };
    const { error: setErr } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    return { error: setErr?.message ?? null };
  };

  const signUp: AuthContextValue["signUp"] = async ({ username, email, password }) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/confirmed`,
        data: { username },
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const resetPassword: AuthContextValue["resetPassword"] = async (email) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, signIn, signUp, signOut, resetPassword, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useKommenszlapfAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useKommenszlapfAuth must be used within KommenszlapfAuthProvider");
  return ctx;
}
