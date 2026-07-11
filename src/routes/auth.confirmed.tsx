import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/auth/confirmed")({
  head: () => ({ meta: [{ title: "Email confirmed — Noventrum" }] }),
  component: ConfirmedPage,
});

function ConfirmedPage() {
  return (
    <div className="min-h-dvh grid place-items-center bg-background p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 grid place-items-center mb-4">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Email confirmed</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Your Kommenszlapf account is ready. You can now sign in on any app in the family.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Return to Noventrum home
        </Link>
      </Card>
    </div>
  );
}
