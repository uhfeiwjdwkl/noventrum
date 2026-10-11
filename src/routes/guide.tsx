import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BookOpen, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/guide")({
  head: () => ({ meta: [
    { title: "User Guide — Noventrum" },
    { name: "description", content: "A complete guide to Noventrum: accounts, transactions, transfers, forex, investments, dividends, statement imports, charts, budgets and data." },
    { property: "og:title", content: "User Guide — Noventrum" },
    { property: "og:description", content: "Learn how to record your finances, manage investments, import statements and understand your Noventrum charts and balances." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: GuidePage,
});

const SECTIONS = [
  {
    id: "getting-started", title: "Start with your accounts", to: "/accounts",
    steps: [
      "Choose your reporting currency in Settings → Default currency. Use Other to enter a currency that is not listed.",
      "Open + Add → Account. Enter a name, institution, account type, currency and balance. Add each bank account, brokerage, cash account, credit card or loan separately.",
      "Record income and expenses, import a statement, or enter your investment buys and sells. Your overview fills in from your own entries; there is no automatic bank connection.",
      "Use the sidebar to move between pages. On smaller screens, open the menu beside the Noventrum logo. Guide is always in that menu and in the dropdown beside the logo.",
    ],
    notes: ["Noventrum is a transaction-based tracker: a buy or sell changes both your investment position and the account’s cash ledger. Do not enter the same trade again as an ordinary income or expense."],
  },
  {
    id: "overview", title: "Dashboard & net worth", to: "/net-worth",
    steps: [
      "Dashboard brings together your balances, cash flow, investments and other financial summaries. Use its page links or the sidebar to open the detailed view.",
      "Net Worth combines assets and liabilities. Accounts, investments, property and physical assets contribute to the picture; debts reduce what you own overall.",
      "Read totals in your default currency. A USD account and an AUD account are converted before they are combined, not simply added as if their currencies were the same.",
      "For a more complete history, enter the actual dates of transactions, trades and asset valuations rather than recording everything on today’s date.",
    ],
  },
  {
    id: "accounts", title: "Accounts, balances & their ledgers", to: "/accounts",
    steps: [
      "Click an account to open its details: balance, cash and investments, a historical chart, and its dated transaction list.",
      "Use Money in or Money out to record an inflow or outflow with that account already selected. Use Transfer or Forex for movements that are not earnings or spending.",
      "Filter its ledger by transaction type, including dividends and transfers. Edit or delete entries with their row controls; use Bulk edit when you need to change several entries.",
      "Edit the account when its recorded balance needs an override. The balance and its date act as a reference point; earlier and later cash movements are worked out relative to that point.",
      "Choose a chart period, or Since first for the available account history. Select two points to compare an amount and percentage change; external deposits and withdrawals are distinguished from investment growth.",
    ],
    notes: ["An account balance is not the same thing as investment profit. Deposits increase your money without being a market gain. Keep the balance reference date and backdated entries consistent."],
  },
  {
    id: "transactions", title: "Income, expenses & recurring entries", to: "/transactions",
    steps: [
      "Open + Add → Transaction, or use Money in / Money out inside an account. Choose income or expense, then enter the merchant or payer, amount, category, account, date and optional notes.",
      "Enter the amount as a positive number in the form: the income/expense choice determines whether money comes in or goes out.",
      "Use Income to review earnings by source, Expenses to review spending, and Transactions for the combined ledger. Use the search and filters on those pages to narrow the list.",
      "For a repeating payment, enable recurring and choose how often it repeats: every chosen number of days, weeks or months. Set its starting date and, optionally, an ending date.",
      "Deleting a recurring rule stops future generated entries; it does not remove entries already logged. Edit or delete those entries separately if they also need correction.",
      "Use + Add → Income source to keep track of a payer or income-producing source. Record its actual receipts as dated income transactions so your cash-flow history reflects money received.",
    ],
    notes: ["Moving your own money between accounts is a transfer, not income or an expense. Investment settlements are also not a second salary or purchase."],
  },
  {
    id: "transfers", title: "Transfers between your own accounts", to: "/accounts",
    steps: [
      "Choose + Add → Transfer between accounts, or press Transfer inside an account.",
      "Select two different accounts: From and To. Enter the amount, date and any notes.",
      "When the accounts use different currencies, enter the amount that actually arrived in the destination account. For a currency conversion with an explicit rate and fees, use Forex instead.",
      "Save the transfer to record both sides of the movement. It changes the two balances without counting as income or spending.",
    ],
    notes: ["Older entries that you originally recorded as ordinary income or expenses retain those labels. Recording a new transfer does not automatically correct or replace them."],
  },
  {
    id: "forex", title: "Forex & money held in several currencies", to: "/accounts",
    steps: [
      "Choose + Add → Forex transaction, or press Forex inside an account.",
      "Select Within one account to keep the converted money in the original account. Choose the account, Convert from currency and Convert into currency. Choose Between accounts to send the conversion to a different account.",
      "Enter the amount, fees, exchange rate and date. Rate on date looks up a rate for that date; replace it with your actual executed rate if your institution used a different one.",
      "The rate means 1 unit of the source currency equals the entered number of destination units. Fees are deducted in the source currency before conversion: received = (amount − fees) × rate.",
      "Check the received amount and press Record exchange. Both currency movements are recorded on the ledger, including for a conversion within one account.",
    ],
    notes: ["Foreign cash contributes to today’s account balance at today’s exchange rate. Historical entries retain their dates and currencies, so an old conversion and today’s reporting value need not be identical."],
  },
  {
    id: "investments", title: "Stocks, ETFs, commodities & trades", to: "/investments",
    steps: [
      "Use + Add → Buy / Sell to record an investment transaction. Search for the ticker, check the exchange and currency, then choose the settlement account.",
      "Enter buy or sell, date, number of shares or units, unit price, fees and any tax. The asset name follows the selected ticker; check that it is the instrument you intended.",
      "Changing the date attempts to fill the price from that day’s historical market price. You can overwrite it with your actual execution price, which may differ from the daily close.",
      "Holdings are derived from your trades, not entered as a separate starting position. Backlog earlier buys and sells with their real dates to build a useful history.",
      "Click a holding to open its chart, Buy / Sell controls and transaction history. Sell all fills the remaining quantity for a complete exit; check the sale date, price and fees before saving.",
      "Use Investments for holdings and trade management, and Portfolio for allocation and performance. Refresh prices retrieves the latest available quotes; quotes can be delayed or unavailable.",
    ],
    notes: ["Unrealised P/L is the gain or loss on what you still hold. Realised P/L comes from units already sold. Total P/L includes both, so a fully sold position can still show a result. Dividends are recorded separately; the My position chart also includes them."],
  },
  {
    id: "dividends", title: "Dividends & withholding tax", to: "/dividends",
    steps: [
      "Choose + Add → Dividend, or the dividend action available in a holding. Search your own assets to choose the ticker.",
      "Enter the payment date, amount, currency, withholding tax and receiving account. Use the actual dividend payment date, not the announcement date.",
      "The net payment is written to the account ledger and linked to the dividend. Do not add a second ordinary income transaction for the same payment.",
      "Use Dividends to review payments grouped by asset. Edit or delete the dividend itself to keep its linked cash entry consistent; bulk controls are available for multiple payments.",
      "The account ledger can be filtered to dividends, and a holding’s history includes its related payments. Dividend forms can infer an account from the asset’s trades when one is not explicitly supplied; check where the payment belongs.",
    ],
  },
  {
    id: "charts", title: "Price charts, position charts & custom graphs", to: "/",
    steps: [
      "Use the period controls on account and investment charts to change the time window. Since first starts at the first relevant recorded activity where that option is available.",
      "On investment price charts, buy/sell dots mark your dated trades. Select two chart points to compare their value and percentage change.",
      "Turn on My position to see your position’s net value over time rather than just the market’s unit price: remaining units × price, plus sale proceeds and net dividends, minus purchase costs and fees.",
      "My position can be negative: money spent to build a position can exceed its current value and cash returned. It is not simply the number of shares multiplied by the quote.",
      "On Dashboard → My charts, press Add chart. Choose net worth, portfolio value, portfolio gain / loss, portfolio return, income, expenses, net cash flow, savings rate or cash & accounts.",
      "Choose a line or bar chart and a period: 3, 6, 8, 12, 24, 36 or 60 months, or since first activity. The remove icon removes that custom graph, not its underlying financial entries.",
    ],
    notes: ["Charts depend on your entered activity and available market/FX history. An empty chart means there is no usable data for that period. Historical quotes are fetched when needed rather than stored as permanent statement data."],
  },
  {
    id: "watchlist", title: "Watchlist & ticker warnings", to: "/watchlist",
    steps: [
      "Add a ticker to Watchlist to follow its latest available quote and price history without buying it. You can add several tickers together using the bulk entry option.",
      "Open an asset’s chart and choose a period to review its market history. A watchlist entry alone does not add a holding or change your net worth.",
      "A ticker warning means a recorded trade price is more than 10% away from that day’s market price. Check the ticker, currency, date and price before deciding whether the entry is wrong.",
      "Dismiss a reviewed warning, or switch Flag possible wrong tickers off in Settings. Restore cleared warnings there if you want those tickers checked again.",
      "Open the bell for notifications. Large daily market-move notices use a move of more than 10% for held assets; ticker-check notices are a separate kind of warning.",
    ],
    notes: ["A warning is a prompt to review, not proof of a mistake. The daily closing price may legitimately differ from your execution price, especially in a volatile market."],
  },
  {
    id: "bulk-edit", title: "Editing & deleting several entries", to: "/investments",
    steps: [
      "In supported account, investment, holding and dividend ledgers, press Bulk edit first. This reveals selection checkboxes rather than leaving them visible all the time.",
      "Select the entries you want to change, or select all in the current list. Use Edit to open the shared-fields form.",
      "Change only the fields you intend to apply to the entire selection. Available fields depend on the entry type and can include date, account, currency, ticker, name, price, side or category.",
      "Use Delete to remove the selected entries, and Done to leave selection mode. Check the selection carefully before confirming a deletion.",
    ],
    notes: ["Changing a trade or dividend can change its linked cash entry, holdings and historical totals. Export a backup before making extensive corrections."],
  },
  {
    id: "imports", title: "Importing NAB, Superhero & other statements", to: "/settings",
    steps: [
      "Open Import statement from Settings or an account. Choose the institution before selecting the file: Superhero, NAB or Generic (auto). Upload a CSV or JSON file, not a PDF or screenshot.",
      "Review the preview: date, entry type, asset or description, amount, currency and action. Choose a Destination account or Create new account. That single destination applies to the whole import.",
      "For Superhero, Trade Settlement rows are ignored to avoid recording a trade twice. Transfer rows are also ignored; record genuine transfers or forex conversions separately with their dedicated forms.",
      "Superhero buy/sell details are read from the merchant text. Dividend names are extracted from the words after ‘dividend from’, matched to your existing assets first, then searched in market data if necessary. A$ means AUD; plain $ means USD for this institution.",
      "For NAB, transaction dates, amounts and descriptions are read using NAB’s column names. Day/month/year dates are supported. Review the imported categories rather than assuming they match your personal budget categories.",
      "Possible duplicates are marked in the preview. Review each row’s Keep both, Update existing or Keep old (skip) choice before pressing Import entries. Keep both is the initial choice, so re-importing without review can add duplicates.",
      "After importing, check the destination ledger and, for investments, its trades and dividends. If the preview identifies the wrong asset or currency, cancel and correct the source file instead of importing it blindly.",
    ],
    notes: ["Statement formats vary. Generic does not understand every institution’s export, and matching an asset name can pick the wrong exchange. For an ordinary cash duplicate, Keep old is the safest way to avoid adding it again; make corrections through the ledger editor."],
  },
  {
    id: "formats", title: "Preparing a CSV or JSON import", to: "/settings",
    steps: [
      "For ordinary Generic CSV entries, use columns date, amount, merchant (or description), category and currency. Use YYYY-MM-DD dates. Positive amounts are incoming; negative amounts are outgoing.",
      "For trades, include kind=trade, symbol, side (buy or sell), shares (quantity or qty also works), price and optionally fees and name. A trade’s cash entry is generated from its trade details.",
      "Quote CSV descriptions that contain commas. Preserve line breaks inside quoted Superhero merchant cells so the ticker and BUY/SELL details can be read correctly.",
      "Generic JSON accepts an array of row objects or an object containing transactions and trades arrays. Use the same field names as the CSV columns.",
      "Treat Export all data (JSON) as a backup, not a guaranteed one-click full restore: statement import does not restore every exported setting or asset type. Generic dividend rows are not handled with Superhero’s dividend-name rules; add those payments with the Dividend form instead.",
    ],
    notes: ["Example cash row: date=2026-07-01, amount=-25.50, merchant=Groceries, category=Food, currency=AUD. Example trade row: kind=trade, date=2026-07-01, symbol=NVDA, side=buy, shares=2, price=150, fees=2, currency=USD. These are illustrative entries, not market prices."],
  },
  {
    id: "assets", title: "Property & other non-digital assets", to: "/property",
    steps: [
      "Use Property for real estate and Other Assets for vehicles, collectibles, jewellery and other physical items. Add the asset from its page or the + Add menu.",
      "Enter the purchase details, cost and current estimated value. For property, include the relevant mortgage and acquisition costs where the form provides them.",
      "Open Value history to add valuations with specific dates. The latest recorded valuation becomes the current value, and earlier dated values help build historical net worth.",
      "Use the valuation chart to review changes and compare two points. Delete an incorrect valuation from its history rather than replacing all of the asset’s past values.",
      "When an asset is sold, use its sale controls and enter the actual sale details. Check the resulting asset status and receiving cash account.",
    ],
    notes: ["These values are your estimates or recorded valuations; Noventrum does not automatically appraise a property, car or collectible."],
  },
  {
    id: "planning", title: "Budgets, goals & reports", to: "/reports",
    steps: [
      "In Budget, add a monthly spending limit for a category. Categorise your expense entries consistently so the spent-versus-limit comparison uses the intended transactions.",
      "In Goals, add a savings target, current progress and a deadline. Update the recorded progress as your savings change; a goal is a planning record, not a bank transfer.",
      "Open Reports to review financial summaries and activity. A trade-linked cash entry represents the same buy or sell, not a second trade to count again.",
      "If a report looks wrong, inspect the underlying account ledger, transaction categories, dates, currencies and trade/dividend links before changing a total.",
    ],
  },
  {
    id: "settings", title: "Currency, appearance & preferences", to: "/settings",
    steps: [
      "Settings → Default currency changes the currency used to report totals. Confirm the change and allow historical revaluation to finish; it does not mean you actually exchanged money.",
      "Use the sun/moon button in the header to switch between light and dark appearance. The choice is saved on this device.",
      "Settings also contains a timezone selector and notification preference switches. The displayed clock follows your device’s local date and time.",
      "Flag possible wrong tickers controls the price-mismatch checks. Other preference switches, such as weekly summary email, should not be treated as confirmation that email or scheduled alerts are being delivered.",
    ],
  },
  {
    id: "data", title: "Signing in, syncing & protecting your data", to: "/settings",
    steps: [
      "Without signing in, your entries are stored in this browser on this device. Clearing browser storage or switching browsers can make that local data unavailable.",
      "Use Sign in in the header to open your Kommenszlapf account. The Create tab offers registration; Forgot requests a password reset. Follow any confirmation instructions shown by the account form.",
      "Export local data before signing in: signing in can replace this device’s local data with your account’s saved data. Noventrum’s signed-in sync is for its own finance records, not a shared ledger with sibling apps.",
      "When signed in, open your account in the header to change username, email or password, export account data, sign out or request account deletion. Account changes may ask you to confirm your current password.",
      "Settings → Export all data (JSON) downloads a snapshot. Keep backups somewhere safe, especially before a large import, bulk edit, sign-in or reset.",
      "Delete all data in Settings clears your Noventrum financial records after confirmation. Delete account in the account dialog is a different action affecting your shared Kommenszlapf identity. Neither action should be used just to fix a single row.",
    ],
    notes: ["Market quotes and historical prices can be fetched again; your entered transactions, trades and valuations are the important records to preserve. If a save or lookup fails, check the message and connection before assuming the change has reached another device."],
  },
] as const;

function GuidePage() {
  return (
    <AppShell title="Guide" subtitle="From your first account to a complete financial history.">
      <div className="max-w-5xl">
        <div className="mb-8 flex items-start gap-3 border-b border-border pb-6">
          <BookOpen className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">Find the task you need below. Each section explains where to go, what to enter and how the result affects your finances.</p>
        </div>
        <nav aria-label="Guide topics" className="mb-10 border-b border-border pb-8">
          <h2 className="mb-4 text-lg font-semibold">In this guide</h2>
          <ol className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {SECTIONS.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                  <span>{section.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="divide-y divide-border">
          {SECTIONS.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 py-8 first:pt-0">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <h2 className="flex items-start gap-3 text-xl font-semibold">
                  <span className="mt-1 font-mono text-xs font-normal text-primary">{String(index + 1).padStart(2, "0")}</span>
                  <span>{section.title}</span>
                </h2>
                <Link to={section.to} className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline">Open page <ExternalLink className="h-3.5 w-3.5" /></Link>
              </div>
              <ol className="max-w-3xl list-decimal space-y-3 pl-6 text-sm leading-7 text-muted-foreground marker:text-primary">
                {section.steps.map((step) => <li key={step} className="pl-1">{step}</li>)}
              </ol>
              {"notes" in section && section.notes.map((note) => <p key={note} className="mt-5 max-w-3xl border-l-2 border-primary/40 pl-4 text-sm leading-7 text-muted-foreground">{note}</p>)}
              <a href="#guide-top" className="mt-5 inline-flex min-h-9 items-center text-xs text-primary hover:underline">Back to topics ↑</a>
            </section>
          ))}
        </div>
        <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
          <a href="https://kommenszlapf.website" className="inline-flex min-h-10 items-center gap-1.5 text-primary hover:underline">Visit kommenszlapf.website <ExternalLink className="h-3.5 w-3.5" /></a>
        </footer>
      </div>
    </AppShell>
  );
}
