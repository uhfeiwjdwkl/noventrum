import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinance } from "@/lib/finance/store";
import { CurrencyPicker } from "@/components/finance/CurrencyPicker";
import { useKommenszlapfAuth } from "@/lib/kommenszlapfAuth";
import { toast } from "sonner";
import { ImportStatementDialog } from "@/components/finance/ImportStatementDialog";

const TIMEZONES = [
  "UTC", "Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Adelaide",
  "Australia/Perth", "Pacific/Auckland", "Asia/Tokyo", "Asia/Singapore", "Asia/Hong_Kong",
  "Asia/Shanghai", "Asia/Kolkata", "Asia/Dubai", "Europe/London", "Europe/Dublin",
  "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Zurich",
  "Europe/Stockholm", "Europe/Moscow", "Africa/Johannesburg", "America/Sao_Paulo",
  "America/New_York", "America/Toronto", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Vancouver", "Pacific/Honolulu",
];

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Noventrum" },
      { name: "description", content: "Set your default currency, timezone, notification preferences and manage your Noventrum data." },
      { property: "og:title", content: "Settings — Noventrum" },
      { property: "og:description", content: "Default currency, timezone, alerts and data controls for your Noventrum finances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const resetAll = useFinance((s) => s.resetAll);
  const baseCurrency = useFinance((s) => s.settings.baseCurrency);
  const setBaseCurrency = useFinance((s) => s.setBaseCurrency);
  const rebasing = useFinance((s) => s.rebasing);
  const { user } = useKommenszlapfAuth();
  const [timezone, setTimezone] = useState(
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
  );

  async function changeBase(code: string) {
    if (code === baseCurrency) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Change your default currency to ${code}? Every trade will be re-valued using historical exchange rates. This can take a moment.`,
      )
    )
      return;
    const t = toast.loading(`Re-basing everything to ${code}…`);
    await setBaseCurrency(code);
    toast.success(`Default currency is now ${code}`, { id: t });
  }

  function handleReset() {
    if (typeof window !== "undefined" && !window.confirm("Delete ALL accounts, transactions, holdings, budgets and goals? This cannot be undone.")) return;
    resetAll();
    toast.success("All data cleared");
  }

  function exportData() {
    const state = useFinance.getState();
    const data = {
      accounts: state.accounts,
      transactions: state.transactions,
      holdings: state.holdings,
      trades: state.trades,
      budgets: state.budgets,
      goals: state.goals,
      dividends: state.dividends,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `noventrum-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Settings" subtitle="Preferences, profile and data.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <h2 className="font-semibold mb-1">Profile</h2>
          <p className="text-sm text-muted-foreground">Basic account information.</p>
        </div>
        <Card className="p-6 lg:col-span-2 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!user && (
              <>
                <div><Label>Name</Label><Input defaultValue="" placeholder="Your name" className="mt-1.5" /></div>
                <div><Label>Email</Label><Input type="email" defaultValue="" placeholder="you@example.com" className="mt-1.5" /></div>
              </>
            )}
            <div><Label>Default currency</Label>
              <div className="mt-1.5">
                <CurrencyPicker value={baseCurrency} onChange={changeBase} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {rebasing
                  ? "Recalculating your ledger at historical rates…"
                  : "All balances, holdings and returns are reported in this currency."}
              </p>
            </div>

            <div>
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {user && (
            <p className="text-xs text-muted-foreground">
              Signed in as {user.email} — name and email are managed in your Kommenszlapf account.
            </p>
          )}
          <div><Button onClick={() => toast.success("Profile saved")}>Save changes</Button></div>
        </Card>

        <Separator className="lg:col-span-3" />

        <div className="lg:col-span-1">
          <h2 className="font-semibold mb-1">Preferences</h2>
          <p className="text-sm text-muted-foreground">Appearance and notifications.</p>
        </div>
        <Card className="p-6 lg:col-span-2 gap-4">
          {[
            ["Weekly summary email", "A recap of your finances every Monday", false],
            ["Budget alerts", "Notify me when I'm nearing a limit", true],
            ["Large transactions", "Alert for transactions over $500", true],
            ["Investment updates", "Daily market close notifications", true],
          ].map(([t, d, on]) => (
            <div key={t as string} className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{t}</div>
                <div className="text-sm text-muted-foreground">{d}</div>
              </div>
              <Switch defaultChecked={on as boolean} />
            </div>
          ))}
        </Card>

        <Separator className="lg:col-span-3" />

        <div className="lg:col-span-1">
          <h2 className="font-semibold mb-1">Data</h2>
          <p className="text-sm text-muted-foreground">Export or reset your data. Everything is stored locally on this device.</p>
        </div>
        <Card className="p-6 lg:col-span-2 flex flex-wrap gap-3">
          <ImportStatementDialog />
          <Button variant="outline" onClick={exportData}>Export all data (JSON)</Button>
          <Button variant="destructive" onClick={handleReset}>Delete all data</Button>
        </Card>
      </div>
    </AppShell>
  );
}
