import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UserCircle, LogOut, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useKommenszlapfAuth } from "@/lib/kommenszlapfAuth";
import { supabase } from "@/integrations/supabase/client";
import { useFinance } from "@/lib/finance/store";

export function KommenszlapfAccountButton({ onOpen }: { onOpen: () => void }) {
  const { user, profile } = useKommenszlapfAuth();
  return (
    <Button variant="ghost" size="sm" onClick={onOpen} className="gap-2">
      <UserCircle className="h-4 w-4" />
      <span className="hidden sm:inline">{user ? profile?.username ?? "Account" : "Sign in"}</span>
    </Button>
  );
}

export function KommenszlapfAccountMenuItem({ onOpen }: { onOpen: () => void }) {
  const { user, profile } = useKommenszlapfAuth();
  return (
    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onOpen(); }}>
      <UserCircle className="h-4 w-4 mr-2" />
      {user ? profile?.username ?? "Account" : "Sign in"}
    </DropdownMenuItem>
  );
}

export function KommenszlapfAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user, profile, signIn, signUp, signOut, resetPassword, refreshProfile } = useKommenszlapfAuth();

  if (user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <SignedIn
            username={profile?.username ?? ""}
            email={profile?.email ?? user.email ?? ""}
            onSignOut={async () => { await signOut(); onOpenChange(false); toast.success("Signed out"); }}
            refreshProfile={refreshProfile}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sign in with Kommenszlapf</DialogTitle>
          <DialogDescription>
            One account for every app on kommenszlapf.website.
          </DialogDescription>
        </DialogHeader>
        <SignedOut
          onSignIn={signIn}
          onSignUp={signUp}
          onReset={resetPassword}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SignedOut({
  onSignIn,
  onSignUp,
  onReset,
  onDone,
}: {
  onSignIn: (a: { identifier: string; password: string }) => Promise<{ error: string | null }>;
  onSignUp: (a: { username: string; email: string; password: string }) => Promise<{ error: string | null }>;
  onReset: (email: string) => Promise<{ error: string | null }>;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [pw, setPw] = useState("");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const [resetEmail, setResetEmail] = useState("");

  async function handleSignIn() {
    setBusy(true);
    const { error } = await onSignIn({ identifier, password: pw });
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Signed in");
    onDone();
  }

  async function handleSignUp() {
    if (pw1 !== pw2) return toast.error("Passwords don't match");
    if (pw1.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    const { error } = await onSignUp({ username, email, password: pw1 });
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Account created — check your email to confirm.");
  }

  async function handleReset() {
    setBusy(true);
    const { error } = await onReset(resetEmail);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Password reset email sent");
  }

  return (
    <Tabs defaultValue="signin">
      <TabsList className="grid grid-cols-3 w-full">
        <TabsTrigger value="signin">Sign in</TabsTrigger>
        <TabsTrigger value="signup">Create</TabsTrigger>
        <TabsTrigger value="reset">Forgot</TabsTrigger>
      </TabsList>

      <TabsContent value="signin" className="space-y-3 pt-3">
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <span>Signing in replaces the local data on this device with your account data.</span>
        </div>
        <div><Label>Username or email</Label><Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="mt-1.5" /></div>
        <div><Label>Password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1.5" /></div>
        <Button className="w-full" onClick={handleSignIn} disabled={busy || !identifier || !pw}>Sign in</Button>
      </TabsContent>

      <TabsContent value="signup" className="space-y-3 pt-3">
        <div><Label>Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1.5" /></div>
        <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" /></div>
        <div><Label>Password</Label><Input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} className="mt-1.5" /></div>
        <div><Label>Confirm password</Label><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="mt-1.5" /></div>
        <Button className="w-full" onClick={handleSignUp} disabled={busy || !username || !email || !pw1}>Create account</Button>
      </TabsContent>

      <TabsContent value="reset" className="space-y-3 pt-3">
        <div><Label>Email</Label><Input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="mt-1.5" /></div>
        <Button className="w-full" onClick={handleReset} disabled={busy || !resetEmail}>Send reset email</Button>
      </TabsContent>
    </Tabs>
  );
}

function SignedIn({
  username,
  email,
  onSignOut,
  refreshProfile,
}: {
  username: string;
  email: string;
  onSignOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<null | "username" | "email" | "password" | "delete">(null);
  const [currentPw, setCurrentPw] = useState("");
  const [currentPw2, setCurrentPw2] = useState("");
  const [newVal, setNewVal] = useState("");
  const [newPw2, setNewPw2] = useState("");

  async function verifyPassword(): Promise<boolean> {
    if (currentPw !== currentPw2) { toast.error("Passwords don't match"); return false; }
    const { error } = await supabase.auth.signInWithPassword({ email, password: currentPw });
    if (error) { toast.error("Current password is incorrect"); return false; }
    return true;
  }

  async function commit() {
    setBusy(true);
    const ok = await verifyPassword();
    if (!ok) { setBusy(false); return; }
    if (mode === "username") {
      const { error } = await supabase
        .from("kommenszlapf_profiles")
        .update({ username: newVal })
        .eq("email", email);
      if (error) toast.error(error.message);
      else { toast.success("Username updated"); await refreshProfile(); reset(); }
    } else if (mode === "email") {
      const { error } = await supabase.auth.updateUser({ email: newVal });
      if (error) toast.error(error.message);
      else { toast.success("Confirmation email sent"); reset(); }
    } else if (mode === "password") {
      if (newVal !== newPw2) { toast.error("New passwords don't match"); setBusy(false); return; }
      const { error } = await supabase.auth.updateUser({ password: newVal });
      if (error) toast.error(error.message);
      else { toast.success("Password updated"); reset(); }
    } else if (mode === "delete") {
      const { error } = await supabase.functions.invoke("delete-account", {});
      if (error) toast.error(error.message);
      else { toast.success("Account deleted"); await onSignOut(); }
    }
    setBusy(false);
  }

  function reset() {
    setMode(null); setCurrentPw(""); setCurrentPw2(""); setNewVal(""); setNewPw2("");
  }

  async function exportData() {
    const state = useFinance.getState();
    const data = {
      account: { username, email },
      accounts: state.accounts, transactions: state.transactions, holdings: state.holdings,
      trades: state.trades, budgets: state.budgets, goals: state.goals, dividends: state.dividends,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `noventrum-${username || "account"}-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>{username || "Account"}</DialogTitle>
        <DialogDescription>{email}</DialogDescription>
      </DialogHeader>

      {mode === null && (
        <div className="grid grid-cols-1 gap-2">
          <Button variant="outline" onClick={exportData}>Export account data</Button>
          <Button variant="outline" onClick={() => setMode("username")}>Change username</Button>
          <Button variant="outline" onClick={() => setMode("email")}>Change email</Button>
          <Button variant="outline" onClick={() => setMode("password")}>Change password</Button>
          <Separator className="my-2" />
          <Button variant="destructive" onClick={() => setMode("delete")}>Delete account</Button>
          <Button variant="ghost" onClick={onSignOut}><LogOut className="h-4 w-4 mr-2" /> Sign out</Button>
        </div>
      )}

      {mode && (
        <div className="space-y-3">
          <h4 className="font-medium">
            {mode === "username" && "Change username"}
            {mode === "email" && "Change email"}
            {mode === "password" && "Change password"}
            {mode === "delete" && "Delete account"}
          </h4>
          {mode !== "delete" && mode !== "password" && (
            <div><Label>New {mode}</Label><Input value={newVal} onChange={(e) => setNewVal(e.target.value)} className="mt-1.5" /></div>
          )}
          {mode === "password" && (
            <>
              <div><Label>New password</Label><Input type="password" value={newVal} onChange={(e) => setNewVal(e.target.value)} className="mt-1.5" /></div>
              <div><Label>Confirm new password</Label><Input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} className="mt-1.5" /></div>
            </>
          )}
          <Separator />
          <p className="text-xs text-muted-foreground">Confirm your current password twice to continue.</p>
          <div><Label>Current password</Label><Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="mt-1.5" /></div>
          <div><Label>Current password (again)</Label><Input type="password" value={currentPw2} onChange={(e) => setCurrentPw2(e.target.value)} className="mt-1.5" /></div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={reset} disabled={busy}>Cancel</Button>
            <Button variant={mode === "delete" ? "destructive" : "default"} onClick={commit} disabled={busy}>
              {mode === "delete" ? "Delete forever" : "Confirm"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
