import { createServerFn } from "@tanstack/react-start";
import {
  quoteWithFallback,
  historyWithFallback,
  fxRate,
  fxRateAt,
  searchYahoo,
  type PriceSource,
} from "@/lib/prices.server";

/**
 * Live prices, historical closes, FX rates and ticker search.
 * Source chain: Yahoo Finance -> Stooq -> Google Finance.
 * Server-side only — these providers block browser CORS.
 */

export interface SymbolMatch {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export interface Quote {
  symbol: string;
  price: number;
  previousClose: number;
  currency: string;
  name: string;
  exchange: string;
  dayChangePct: number;
  source: PriceSource;
}

export interface HistoryPoint {
  date: string;
  close: number;
}

/** Ticker autocomplete — stocks, ETFs, crypto, futures, FX. */
export const searchSymbols = createServerFn({ method: "GET" })
  .inputValidator((data: { query: string }) => data)
  .handler(async ({ data }): Promise<SymbolMatch[]> => {
    const q = data.query.trim();
    if (q.length < 1) return [];
    try {
      const matches = await searchYahoo(q);
      if (matches.length > 0) return matches;
      return [{ symbol: q.toUpperCase(), name: q.toUpperCase(), exchange: "", type: "Ticker" }];
    } catch {
      return [{ symbol: q.toUpperCase(), name: q.toUpperCase(), exchange: "", type: "Ticker" }];
    }
  });

export const getQuote = createServerFn({ method: "GET" })
  .inputValidator((data: { symbol: string }) => data)
  .handler(async ({ data }): Promise<Quote> => quoteWithFallback(data.symbol));

export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((data: { symbols: string[] }) => data)
  .handler(async ({ data }): Promise<Record<string, Quote>> => {
    const out: Record<string, Quote> = {};
    await Promise.all(
      data.symbols.map(async (sym) => {
        try {
          out[sym] = await quoteWithFallback(sym);
        } catch {
          // one failure must not sink the batch
        }
      }),
    );
    return out;
  });

export const getHistory = createServerFn({ method: "GET" })
  .inputValidator((data: { symbol: string; range?: string; interval?: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ symbol: string; currency: string; points: HistoryPoint[]; source: PriceSource }> => {
      const { currency, points, source } = await historyWithFallback(
        data.symbol,
        data.range ?? "5y",
        data.interval ?? "1mo",
      );
      return { symbol: data.symbol.toUpperCase(), currency, points, source };
    },
  );

/** Live FX: map of currency -> value of 1 unit expressed in `base`. */
export const getFxRates = createServerFn({ method: "POST" })
  .inputValidator((data: { base: string; symbols: string[] }) => data)
  .handler(async ({ data }): Promise<Record<string, number>> => {
    const out: Record<string, number> = {};
    await Promise.all(
      data.symbols.map(async (sym) => {
        try {
          out[sym] = await fxRate(sym, data.base);
        } catch {
          // leave unset; caller falls back to 1
        }
      }),
    );
    return out;
  });

/** Historical FX for backdated trades and re-basing the whole ledger. */
export const getFxRateAt = createServerFn({ method: "POST" })
  .inputValidator((data: { from: string; to: string; date: string }) => data)
  .handler(async ({ data }): Promise<number> => {
    try {
      return await fxRateAt(data.from, data.to, data.date);
    } catch {
      return 0;
    }
  });

/** Batch historical FX — used when the default currency changes. */
export const getFxRatesAt = createServerFn({ method: "POST" })
  .inputValidator((data: { to: string; pairs: { from: string; date: string }[] }) => data)
  .handler(async ({ data }): Promise<Record<string, number>> => {
    const out: Record<string, number> = {};
    await Promise.all(
      data.pairs.map(async ({ from, date }) => {
        const key = `${from}:${date}`;
        try {
          out[key] = await fxRateAt(from, data.to, date);
        } catch {
          // skip
        }
      }),
    );
    return out;
  });

/** Closing price of a symbol on (or just before) an ISO date. Today → live quote. */
export const getPriceAt = createServerFn({ method: "POST" })
  .inputValidator((data: { symbol: string; date: string }) => data)
  .handler(async ({ data }): Promise<{ price: number; currency: string } | null> => {
    const sym = data.symbol.trim();
    if (!sym) return null;
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      if (data.date >= todayIso) {
        const q = await quoteWithFallback(sym);
        return { price: q.price, currency: q.currency };
      }
      const days = Math.ceil((Date.now() - new Date(data.date).getTime()) / 86_400_000) + 10;
      const range = days > 3650 ? "max" : days > 1825 ? "10y" : days > 365 ? "5y" : days > 90 ? "1y" : "3mo";
      const { points, currency } = await historyWithFallback(sym, range, "1d");
      const before = [...points].reverse().find((p) => p.date <= data.date);
      const pt = before ?? points[0];
      return pt ? { price: pt.close, currency } : null;
    } catch {
      return null;
    }
  });
