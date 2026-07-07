import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/finance/StatCard";
import { EmptyState } from "@/components/finance/EmptyState";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/lib/finance/store";
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
import { TrendingUp, TrendingDown, Wallet, Landmark, PiggyBank, Percent, Sparkles } from "lucide-react";
import { AddAccountDialog, AddTransactionDialog } from "@/components/finance/AddDialogs";

export const Route = createFileRoute("/")({ component: Dashboard });

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

function Dashboard() {
  const accounts = useFinance((s) => s.accounts);
  const transactions = useFinance((s) => s.transactions);
  const holdings = useFinance((s) => s.holdings);

  const nw = netWorth(accounts);
  const cashflow = monthlyCashflow(transactions).slice(-12);
  const lastMonth = cashflow[cashflow.length - 1] ?? { income: 0, expense: 0, net: 0 };
  const savingsRate = lastMonth.income > 0 ? ((lastMonth.income - lastMonth.expense) / lastMonth.income) * 100 : 0;
  const nws = netWorthSeries(accounts, transactions);
  const first = nws[0]?.value ?? nw;
  const nwChange = first !== 0 ? ((nw - first) / Math.abs(first)) * 100 : 0;
  const pv = portfolioValue(holdings);
  const pc = portfolioCost(holdings);
  const pReturn = pc > 0 ? ((pv - pc) / pc) * 100 : 0;
  const cats = spendingByCategory(transactions).slice(0, 6);
  const savings = savingsRateSeries(transactions).slice(-12);
  const recent = transactions.slice(0, 6);
  const topHoldings = [...holdings].sort((a, b) => b.shares * b.price - a.shares * a.price).slice(0, 5);

  const isEmpty = accounts.length === 0 && transactions.length === 0 && holdings.length === 0;

  if (isEmpty) {
    return (
      <AppShell title="Welcome to Noventrum" subtitle="Your complete financial picture, in one place.">
        <div className="grid gap-6 md:grid-cols-2">
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title="Start with an account"
            description="Add a checking, savings, credit card, brokerage or loan account to begin tracking your net worth."
            action={{
              label: "Add your first account",
              onClick: () => {},
            }}
          />
          <Card className="p-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent grid place-items-center"><Sparkles className="h-5 w-5 text-primary" /></div>
              <div>
                <div className="font-semibold">Quick start</div>
                <div className="text-sm text-muted-foreground">All your data stays on this device.</div>
              </div>
            </div>
            <ul className="text-sm space-y-2 text-muted-foreground list-decimal list-inside">
              <li>Add one or more <Link to="/accounts" className="text-primary hover:underline">accounts</Link></li>
              <li>Log income and expenses in <Link to="/transactions" className="text-primary hover:underline">transactions</Link></li>
              <li>Set <Link to="/budget" className="text-primary hover:underline">budgets</Link> and <Link to="/goals" className="text-primary hover:underline">savings goals</Link></li>
              <li>Track your portfolio under <Link to="/investments" className="text-primary hover:underline">investments</Link></li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <AddAccountDialog trigger={<Button size="sm"><Wallet className="h-4 w-4 mr-1.5" />Add account</Button>} />
              <AddTransactionDialog trigger={<Button size="sm" variant="outline"><TrendingUp className="h-4 w-4 mr-1.5" />Log transaction</Button>} />
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard" subtitle="Your complete financial picture.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Net Worth" value={nw} change={nwChange} icon={<TrendingUp className="h-4 w-4" />} hint="all time" />
        <StatCard label="Total Assets" value={totalAssets(accounts)} icon={<Landmark className="h-4 w-4" />} />
        <StatCard label="Total Liabilities" value={totalLiabilities(accounts)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Savings Rate" value={savingsRate} currency={false} suffix="%" icon={<Percent className="h-4 w-4" />} hint="this month" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm text-muted-foreground">Net worth over time</div>
              <div className="text-2xl font-semibold num mt-1">{fmtCurrency(nw)}</div>
            </div>
            {nws.length > 1 && (
              <Badge variant="secondary" className={nwChange >= 0 ? "text-success bg-success/10 border-0" : "text-destructive bg-destructive/10 border-0"}>{fmtPct(nwChange)}</Badge>
            )}
          </div>
          <div className="h-64">
            {nws.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">Log transactions to see net worth history.</div>
            ) : (
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
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm text-muted-foreground">Portfolio value</div>
              <div className="text-2xl font-semibold num mt-1">{fmtCurrency(pv)}</div>
            </div>
            {pc > 0 && (
              <Badge variant="secondary" className={pReturn >= 0 ? "text-success bg-success/10 border-0" : "text-destructive bg-destructive/10 border-0"}>{fmtPct(pReturn)}</Badge>
            )}
          </div>
          {topHoldings.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No holdings yet. <Link to="/investments" className="text-primary hover:underline">Add one</Link>.
            </div>
          ) : (
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
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4">
            <div className="text-sm text-muted-foreground">Income vs Expenses</div>
            <div className="text-xs text-muted-foreground/70">Last 12 months</div>
          </div>
          <div className="h-64">
            {cashflow.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">Log transactions to see cash flow.</div>
            ) : (
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
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <div className="text-sm text-muted-foreground">Top spending categories</div>
            <div className="text-xs text-muted-foreground/70">Last 30 days</div>
          </div>
          <div className="h-64">
            {cats.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">No expenses in last 30 days.</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={cats} dataKey="amount" nameKey="category" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {cats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => fmtCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
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
            {savings.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">No data yet.</div>
            ) : (
              <ResponsiveContainer>
                <LineChart data={savings}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => `${v}%`} />
                  <Line type="monotone" dataKey="rate" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Recent activity</div>
            <Link to="/transactions" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No transactions yet.</div>
          ) : (
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
          )}
        </Card>
      </div>
    </AppShell>
  );
}
