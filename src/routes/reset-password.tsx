import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Noventrum" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    if (params.get("type") === "recovery") setReady(true);
    else setReady(true); // still allow — Supabase already sets a session from the link
  }, []);

  async function submit() {
    if (pw1 !== pw2) return toast.error("Passwords don't match");
    if (pw1.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/" });
  }

  if (!ready) return null;

  return (
    <div className="min-h-dvh grid place-items-center bg-background p-6">
      <Card className="max-w-md w-full p-8 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="text-sm text-muted-foreground">Choose a new password for your Kommenszlapf account.</p>
        <div><Label>New password</Label><Input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} className="mt-1.5" /></div>
        <div><Label>Confirm password</Label><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="mt-1.5" /></div>
        <Button className="w-full" disabled={busy || !pw1} onClick={submit}>Update password</Button>
      </Card>
    </div>
  );
}
