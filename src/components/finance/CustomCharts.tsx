import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useFinance, type DashChart, type DashStat } from "@/lib/finance/store";
import { accountBalanceAt, fmtCurrency, monthlyCashflow, netWorthSeries, savingsRateSeries } from "@/lib/finance/data";

const STATS: Record<DashStat, { label: string; pct?: boolean }> = {
  netWorth: { label: "Net worth" },
  portfolioValue: { label: "Portfolio value" },
  portfolioGain: { label: "Portfolio gain / loss" },
  portfolioReturn: { label: "Portfolio return", pct: true },
  income: { label: "Income" },
  expenses: { label: "Expenses" },
  netCashflow: { label: "Net cash flow" },
  savingsRate: { label: "Savings rate", pct: true },
  cash: { label: "Cash & accounts" },
};
const PERIODS = [3, 6, 8, 12, 24, 36, 60];

function useSeries(stat: DashStat, months: number) {
  const s = useFinance();
  const base = s.settings.baseCurrency;
  const today = new Date().toISOString().slice(0, 10);
  const accs = s.accounts.map((a) => ({ ...a, balance: accountBalanceAt(a, s.transactions, today) }));
  let data: { month: string; value: number }[] = [];
  const nwAll = () => netWorthSeries(accs, s.transactions, s.holdings, s.properties, s.physicalAssets, s.trades, s.fxRates, base, s.fxHistory);
  const nwCash = () => netWorthSeries(accs, s.transactions, [], [], [], [], s.fxRates, base, s.fxHistory);
  const portfolio = () => {
    const cash = new Map(nwCash().map((p) => [p.month, p.value]));
    return nwAll().map((p) => ({ month: p.month, value: p.value - (cash.get(p.month) ?? 0) }));
  };
  const invested = () => {
    const cf = monthlyCashflow(s.transactions.filter((t) => t.tradeId), s.fxRates, base, s.fxHistory);
    const m = new Map<string, number>();
    let run = 0;
    for (const c of cf) { run += c.expense - c.income; m.set(c.month, run); }
    return m;
  };
  const cfSeries = (k: "income" | "expense" | "net") =>
    monthlyCashflow(s.transactions.filter((t) => !t.tradeId), s.fxRates, base, s.fxHistory).map((c) => ({ month: c.month, value: c[k] }));

  switch (stat) {
    case "netWorth": data = nwAll(); break;
    case "cash": data = nwCash(); break;
    case "portfolioValue": data = portfolio(); break;
    case "portfolioGain":
    case "portfolioReturn": {
      const inv = invested();
      let last = 0;
      data = portfolio().map((p) => {
        last = inv.get(p.month) ?? last;
        const gain = p.value - last;
        return { month: p.month, value: stat === "portfolioGain" ? gain : last > 0 ? +((gain / last) * 100).toFixed(2) : 0 };
      });
      break;
    }
    case "income": data = cfSeries("income"); break;
    case "expenses": data = cfSeries("expense"); break;
    case "netCashflow": data = cfSeries("net"); break;
    case "savingsRate": data = savingsRateSeries(s.transactions, s.fxRates, base, s.fxHistory).map((r) => ({ month: r.month, value: r.rate })); break;
  }
  return data.slice(-months);
}

function ChartCard({ chart, onRemove }: { chart: DashChart; onRemove: () => void }) {
  const data = useSeries(chart.stat, chart.months);
  const meta = STATS[chart.stat];
  const fmt = (v: number, compact = false) => (meta.pct ? `${v.toFixed(1)}%` : fmtCurrency(v, { compact }));
  const first = data[0]?.value ?? 0;
  const last = data[data.length - 1]?.value ?? 0;
  const diff = last - first;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm text-muted-foreground">{meta.label} · last {chart.months} months</div>
          <div className="text-xl font-semibold num mt-1">{fmt(last)}</div>
          {data.length > 1 && (
            <div className={"text-xs num " + (diff >= 0 ? "text-success" : "text-destructive")}>
              {diff >= 0 ? "+" : ""}{fmt(diff)}
              {!meta.pct && first !== 0 && ` (${((diff / Math.abs(first)) * 100).toFixed(1)}%)`}
            </div>
          )}
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRemove} aria-label="Remove chart"><X className="h-4 w-4" /></Button>
      </div>
      <div className="h-48">
        {data.length === 0 ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">No data for this period yet.</div>
        ) : (
          <ResponsiveContainer>
            {chart.type === "bar" ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickFormatter={(v) => fmt(v, true)} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickFormatter={(v) => fmt(v, true)} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmt(v)} />
                <Area type="monotone" dataKey="value" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

export function CustomCharts() {
  const charts = useFinance((s) => s.settings.dashboardCharts ?? []);
  const updateSettings = useFinance((s) => s.updateSettings);
  const [open, setOpen] = useState(false);
  const [stat, setStat] = useState<DashStat>("portfolioValue");
  const [months, setMonths] = useState(8);
  const [type, setType] = useState<"line" | "bar">("line");

  const add = () => {
    updateSettings({ dashboardCharts: [...charts, { id: crypto.randomUUID(), stat, months, type }] });
    setOpen(false);
  };
  const remove = (id: string) => updateSettings({ dashboardCharts: charts.filter((c) => c.id !== id) });

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">My charts</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1.5" />Add chart</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add a chart</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Statistic</Label>
                <Select value={stat} onValueChange={(v) => setStat(v as DashStat)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATS) as DashStat[]).map((k) => <SelectItem key={k} value={k}>{STATS[k].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Period</Label>
                <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => <SelectItem key={p} value={String(p)}>Last {p} months</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Style</Label>
                <Select value={type} onValueChange={(v) => setType(v as "line" | "bar")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="line">Line</SelectItem>
                    <SelectItem value="bar">Bars</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={add}>Add to dashboard</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {charts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {charts.map((c) => <ChartCard key={c.id} chart={c} onRemove={() => remove(c.id)} />)}
        </div>
      )}
    </div>
  );
}
