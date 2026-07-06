import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  netWorth,
  totalAssets,
  totalLiabilities,
  monthlyCashflow,
  netWorthSeries,
  spendingByCategory,
  savingsRateSeries,
  portfolioValue,
  portfolioCost,
  holdings,
  transactions,
  fmtCurrency,
  fmtPct,
} from "@/lib/finance/data";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, Landmark, PiggyBank, Percent } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Dashboard });

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

function Dashboard() {
  const nw = netWorth();
  const cashflow = monthlyCashflow().slice(-12);
  const lastMonth = cashflow[cashflow.length - 1] ?? { income: 0, expense: 0, net: 0 };
  const savingsRate = lastMonth.income > 0 ? ((lastMonth.income - lastMonth.expense) / lastMonth.income) * 100 : 0;
  const nws = netWorthSeries();
  const nwChange = ((nws[nws.length - 1].value - nws[nws.length - 13]?.value) / (nws[nws.length - 13]?.value || 1)) * 100;
  const pv = portfolioValue();
  const pc = portfolioCost();
  const pReturn = ((pv - pc) / pc) * 100;
  const cats = spendingByCategory().slice(0, 6);
  const savings = savingsRateSeries().slice(-12);
  const recent = transactions.slice(0, 6);
  const topHoldings = [...holdings].sort((a, b) => b.shares * b.price - a.shares * a.price).slice(0, 5);

  return (
    <AppShell title="Dashboard" subtitle="Your complete financial picture, updated in real time.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Net Worth" value={nw} change={nwChange} icon={<TrendingUp className="h-4 w-4" />} hint="12 mo" />
        <StatCard label="Total Assets" value={totalAssets()} icon={<Landmark className="h-4 w-4" />} />
        <StatCard label="Total Liabilities" value={totalLiabilities()} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Savings Rate" value={savingsRate} currency={false} change={4.2} icon={<Percent className="h-4 w-4" />} hint="vs last mo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm text-muted-foreground">Net worth over time</div>
              <div className="text-2xl font-semibold num mt-1">{fmtCurrency(nw)}</div>
            </div>
            <Badge variant="secondary" className="text-success bg-success/10 border-0">{fmtPct(nwChange)}</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={nws}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, { compact: true })} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmtCurrency(v)} />
                <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} fill="url(#nwGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm text-muted-foreground">Portfolio value</div>
              <div className="text-2xl font-semibold num mt-1">{fmtCurrency(pv)}</div>
            </div>
            <Badge variant="secondary" className={pReturn >= 0 ? "text-success bg-success/10 border-0" : "text-destructive bg-destructive/10 border-0"}>{fmtPct(pReturn)}</Badge>
          </div>
          <div className="space-y-3">
            {topHoldings.map((h) => {
              const val = h.shares * h.price;
              return (
                <div key={h.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{h.symbol}</div>
                    <div className="text-xs text-muted-foreground truncate">{h.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="num font-medium">{fmtCurrency(val, { compact: true })}</div>
                    <div className={"text-xs num " + (h.dayChangePct >= 0 ? "text-success" : "text-destructive")}>{fmtPct(h.dayChangePct)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4">
            <div className="text-sm text-muted-foreground">Income vs Expenses</div>
            <div className="text-xs text-muted-foreground/70">Last 12 months</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={cashflow}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, { compact: true })} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmtCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <div className="text-sm text-muted-foreground">Top spending categories</div>
            <div className="text-xs text-muted-foreground/70">Last 30 days</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={cats} dataKey="amount" nameKey="category" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {cats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmtCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {cats.slice(0, 4).map((c, i) => (
              <div key={c.category} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i] }} />
                  <span>{c.category}</span>
                </div>
                <span className="num text-muted-foreground">{fmtCurrency(c.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Savings rate trend</div>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-48">
            <ResponsiveContainer>
              <LineChart data={savings}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="rate" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Recent activity</div>
            </div>
            <Link to="/transactions" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-border">
            {recent.map((t) => (
              <div key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={"h-9 w-9 rounded-full grid place-items-center shrink-0 " + (t.amount > 0 ? "bg-success/10 text-success" : "bg-muted text-foreground/70")}>
                    {t.amount > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.merchant}</div>
                    <div className="text-xs text-muted-foreground">{t.category} • {t.date}</div>
                  </div>
                </div>
                <div className={"text-sm font-medium num " + (t.amount > 0 ? "text-success" : "")}>{fmtCurrency(t.amount)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
