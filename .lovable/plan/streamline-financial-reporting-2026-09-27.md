# Streamline financial reporting

## What will change
- Show each buy or sell once by merging its linked cash movement and trade record into one report row.
- Keep ordinary income, expenses, transfers, and dividends as separate report entries.
- Present trade rows consistently as date, action, asset, quantity, and total amount, with correct currency formatting.
- Sort the unified activity ledger by date and use stable record identifiers.
- Keep the existing tax and monthly summary views unchanged.

## Technical details
- Exclude transactions generated from trades (`tradeId`) when composing the activity report because the corresponding trade is already shown.
- Build a typed report-row model so descriptions and amounts are formatted in one place.
- Verify the report in the running app and check for build or runtime errors.
