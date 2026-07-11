import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/guide")({
  head: () => ({ meta: [{ title: "Guide — Noventrum" }] }),
  component: GuidePage,
});

function GuidePage() {
  return (
    <AppShell title="Guide" subtitle="How Noventrum works and how it fits into the Kommenszlapf family.">
      <div className="grid gap-6 max-w-3xl">
        <Card className="p-6">
          <h2 className="font-semibold text-lg">What is Noventrum?</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Noventrum is a personal finance dashboard for tracking net worth, cash flow, investments,
            budgets and goals. All your data lives locally on this device unless you sign in with a
            Kommenszlapf account.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-lg">Getting started</h2>
          <ol className="mt-2 text-sm space-y-2 list-decimal list-inside text-muted-foreground">
            <li>Use the <strong>+ Add</strong> menu in the header to create an account, transaction, holding, budget or goal.</li>
            <li>Explore each page in the sidebar — every view populates from what you enter.</li>
            <li>Optional: sign in with Kommenszlapf to sync across devices and sibling apps.</li>
          </ol>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-lg">Kommenszlapf account</h2>
          <p className="text-sm text-muted-foreground mt-2">
            One account works across every app on kommenszlapf.website. Create it once, sign in
            anywhere in the family. Change username, email, password, export your data, or delete
            your account from the header menu.
          </p>
          <a
            href="https://kommenszlapf.website"
            className="inline-flex items-center gap-1.5 text-sm text-primary mt-3 hover:underline"
          >
            Visit kommenszlapf.website <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-lg">Data & privacy</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Local data is stored in your browser. Signed-in data syncs through the shared
            Kommenszlapf account. You can export everything as JSON from Settings or the account
            dialog at any time.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
