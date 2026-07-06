import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { transactions, accounts, fmtCurrency } from "@/lib/finance/data";
import { useMemo, useState } from "react";
import { Search, Download, Upload, Filter } from "lucide-react";

export const Route = createFileRoute("/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Noventrum" }, { name: "description", content: "Search, filter, tag and manage every transaction." }] }),
  component: TransactionsPage,
});

const CATS = Array.from(new Set(transactions.map((t) => t.category))).sort();

function TransactionsPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");
  const [acct, setAcct] = useState<string>("all");

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (q && !t.merchant.toLowerCase().includes(q.toLowerCase()) && !t.category.toLowerCase().includes(q.toLowerCase())) return false;
      if (cat !== "all" && t.category !== cat) return false;
      if (kind !== "all" && t.kind !== kind) return false;
      if (acct !== "all" && t.accountId !== acct) return false;
      return true;
    });
  }, [q, cat, kind, acct]);

  const totalIn = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  return (
    <AppShell
      title="Transactions"
      subtitle={`${filtered.length} of ${transactions.length} transactions`}
      actions={
        <>
          <Button variant="outline" size="sm" className="gap-1.5"><Upload className="h-4 w-4" />Import</Button>
          <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-4 w-4" />Export</Button>
        </>
      }
    >
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search merchant or category…" className="pl-9" />
          </div>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={acct} onValueChange={setAcct}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => { setQ(""); setCat("all"); setKind("all"); setAcct("all"); }}>
            <Filter className="h-4 w-4" />Reset
          </Button>
        </div>
        <div className="flex gap-6 mt-4 text-sm">
          <div><span className="text-muted-foreground">Inflow </span><span className="num font-medium text-success">{fmtCurrency(totalIn)}</span></div>
          <div><span className="text-muted-foreground">Outflow </span><span className="num font-medium">{fmtCurrency(totalOut)}</span></div>
          <div><span className="text-muted-foreground">Net </span><span className="num font-medium">{fmtCurrency(totalIn + totalOut)}</span></div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 200).map((t) => {
              const a = accounts.find((x) => x.id === t.accountId);
              return (
                <TableRow key={t.id} className="cursor-pointer">
                  <TableCell className="num text-muted-foreground whitespace-nowrap">{t.date}</TableCell>
                  <TableCell>
                    <div className="font-medium">{t.merchant}</div>
                    {t.notes && <div className="text-xs text-muted-foreground">{t.notes}</div>}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{t.category}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a?.name}</TableCell>
                  <TableCell>
                    {t.recurring && <Badge variant="outline" className="text-xs">Recurring</Badge>}
                  </TableCell>
                  <TableCell className={"text-right num font-medium " + (t.amount > 0 ? "text-success" : "")}>{fmtCurrency(t.amount)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
