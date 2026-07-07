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
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Noventrum" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const resetAll = useFinance((s) => s.resetAll);

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
            <div><Label>Name</Label><Input defaultValue="" placeholder="Your name" className="mt-1.5" /></div>
            <div><Label>Email</Label><Input type="email" defaultValue="" placeholder="you@example.com" className="mt-1.5" /></div>
            <div><Label>Currency</Label>
              <Select defaultValue="USD">
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                  <SelectItem value="GBP">GBP — British Pound</SelectItem>
                  <SelectItem value="JPY">JPY — Japanese Yen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Timezone</Label><Input defaultValue="America/New_York" className="mt-1.5" /></div>
          </div>
          <div><Button onClick={() => toast.success("Profile saved")}>Save changes</Button></div>
        </Card>

        <Separator className="lg:col-span-3" />

        <div className="lg:col-span-1">
          <h2 className="font-semibold mb-1">Preferences</h2>
          <p className="text-sm text-muted-foreground">Appearance and notifications.</p>
        </div>
        <Card className="p-6 lg:col-span-2 gap-4">
          {[
            ["Weekly summary email", "A recap of your finances every Monday"],
            ["Budget alerts", "Notify me when I'm nearing a limit"],
            ["Large transactions", "Alert for transactions over $500"],
            ["Investment updates", "Daily market close notifications"],
          ].map(([t, d]) => (
            <div key={t} className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{t}</div>
                <div className="text-sm text-muted-foreground">{d}</div>
              </div>
              <Switch defaultChecked />
            </div>
          ))}
        </Card>

        <Separator className="lg:col-span-3" />

        <div className="lg:col-span-1">
          <h2 className="font-semibold mb-1">Data</h2>
          <p className="text-sm text-muted-foreground">Export or reset your data. Everything is stored locally on this device.</p>
        </div>
        <Card className="p-6 lg:col-span-2 flex flex-wrap gap-3">
          <Button variant="outline" onClick={exportData}>Export all data (JSON)</Button>
          <Button variant="destructive" onClick={handleReset}>Delete all data</Button>
        </Card>
      </div>
    </AppShell>
  );
}
