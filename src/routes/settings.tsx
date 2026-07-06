import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — FinFlow" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Preferences, profile and data.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <h2 className="font-semibold mb-1">Profile</h2>
          <p className="text-sm text-muted-foreground">Basic account information.</p>
        </div>
        <Card className="p-6 lg:col-span-2 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Name</Label><Input defaultValue="Alex Morgan" className="mt-1.5" /></div>
            <div><Label>Email</Label><Input type="email" defaultValue="alex@example.com" className="mt-1.5" /></div>
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
          <div><Button>Save changes</Button></div>
        </Card>

        <Separator className="lg:col-span-3" />

        <div className="lg:col-span-1">
          <h2 className="font-semibold mb-1">Preferences</h2>
          <p className="text-sm text-muted-foreground">Appearance and notifications.</p>
        </div>
        <Card className="p-6 lg:col-span-2 gap-4">
          {[
            ["Dark mode", "Follow system or set manually"],
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
          <p className="text-sm text-muted-foreground">Import, export and manage your data.</p>
        </div>
        <Card className="p-6 lg:col-span-2 flex flex-wrap gap-3">
          <Button variant="outline">Export all data (CSV)</Button>
          <Button variant="outline">Import transactions</Button>
          <Button variant="outline">Connect an account</Button>
          <Button variant="destructive">Delete all data</Button>
        </Card>
      </div>
    </AppShell>
  );
}
