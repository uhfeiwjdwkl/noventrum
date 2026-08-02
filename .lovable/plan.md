# Multi-currency trading, price fallbacks, and transaction-first UX

A large upgrade in five parts. Everything stays ledger-based: holdings, cash, FX positions and income are all derived from logged transactions.

## 1. Price data fallback

Yahoo Finance stays primary. Note: Google Finance has no public API — the only way to read it is scraping its quote pages, which is fragile and can break silently. The plan therefore adds a **fallback chain**:

1. Yahoo (current)
2. Stooq CSV (free, no key, stable, covers stocks/ETFs/indices/FX)
3. Google Finance quote-page scrape (`google.com/finance/quote/AAPL:NASDAQ`) as last resort

All three live server-side; each quote/history/FX call tries the next source if the previous one fails or returns nothing. A small `source` field is returned so the UI can show where a price came from.

## 2. Investments: transactions only

- Remove the "Add holding" button and dialog from Investments (and from Markets, where it currently adds to a watchlist — replaced in part 4).
- Buy/Sell dialog gets a **Sell all** button that fills the quantity with the exact current holding, plus a percentage quick-pick (25/50/75/100%).

## 3. Multi-currency: FX positions and cross-currency trades

This is the core change.

- **Custom currencies** — add any currency code in Settings; it appears everywhere a currency is picked.
- **Currency as a tradable asset** — buying USD is logged as a trade of asset class `forex` (symbol `USD`), paid for out of an account in your default currency at the rate on the trade date. It shows on the dashboard valued at its default-currency equivalent, marked to the live rate.
- **Buying with a foreign currency** — a trade in a non-default currency draws from the matching FX position/account. The trade stores: quantity, price in the asset's currency, the FX rate used, and the resulting cost in your default currency.
- **Backdated trades** — if no rate is given, the historical FX rate for that date is fetched and stored on the trade, so the cost is correct in your default currency.
- **Returns** — on sale, proceeds are converted at the sale-date rate, so realized P/L is expressed in your default currency and includes currency gain/loss. Unrealized P/L uses the live rate.
- **Changing default currency** (e.g. USD → AUD) prompts a confirmation explaining it re-fetches historical rates and re-values every trade, then runs a progress-tracked recalculation.

## 4. Markets page

- Same live ticker search as the Buy/Sell tool: search any stock/ETF/crypto/FX, see live quote, day change and a chart, and log a trade straight from the result.
- A watchlist you can add searched symbols to (independent of whether you own them).
- Toggle: show prices in **default currency** or **asset's native currency**, applied across Markets, Investments and the asset detail page.

## 5. Recurring transactions and income

- Recurring setup asks **every N days / weeks / months**, with an optional end date.
- Recurrences generate real transactions as their dates pass. Cancelling a recurring rule stops future entries and **keeps everything already logged**.
- Income becomes fully transaction-based: create, edit, backdate, delete, and **bulk select/delete/edit**.
- **Payers** work like assets: each income entry has a payer, previously used payers are suggested, and clicking a payer opens a detail page with a table of all income from them plus an income-over-time chart — mirroring the asset detail page.

## Technical notes

- New `src/lib/prices.server.ts` holds the Yahoo/Stooq/Google adapters and the fallback chain; `prices.functions.ts` stays a thin `createServerFn` wrapper (required by the server-fn splitter).
- New server fn `getHistoricalFx({ base, symbol, date })` plus a cached `fxHistory` map in the store, keyed `PAIR:YYYY-MM`.
- `Trade` gains `fxRate`, `baseCost` and `baseCurrency`; `Account` gains an `isFx` flag. Store version bumps to 4 with a migration that stamps existing trades with rate `1` and backfills rates on first load.
- `data.ts` conversion helpers (`convert`, `portfolioValue`, `netWorthSeries`, `deriveHoldings`, `realizedPL`) all become currency-aware and take the FX map.
- New `recurringRules` slice in the store plus a materialiser that runs on hydration.
- New route `/income/$payer`; dashboard gets a top row of page shortcut buttons.
- Data lives in local storage as today; no backend changes.

## Sequence

1. Price fallback chain + historical FX server functions
2. Store/data currency model + migration (largest step)
3. Investments/Buy-Sell changes (remove Add holding, sell-all)
4. Settings: custom currencies + default-currency switch with confirmation and recalculation
5. Markets rebuild with search, watchlist and currency toggle
6. Recurring rules + income/payers overhaul
7. Dashboard shortcut buttons
