import { createServerFn } from "@tanstack/react-start";

/**
 * Live prices, historical closes, and FX rates via Yahoo Finance's
 * public chart endpoint. No auth required. Server-side only because
 * Yahoo blocks browser CORS.
 */

const CHART = "https://query1.finance.yahoo.com/v8/finance/chart/";

async function fetchYahoo(symbol: string, range: string, interval: string) {
  const url = `${CHART}${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await fetch(url, {
    headers: {
      // Yahoo returns 401 without a UA.
      "User-Agent":
        "Mozilla/5.0 (compatible; Noventrum/1.0; +https://noventrum.kommenszlapf.website)",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Yahoo ${res.status}: ${txt.slice(0, 120)}`);
  }
  return res.json() as Promise<{
    chart: {
      error?: { code: string; description: string } | null;
      result?: Array<{
        meta: {
          symbol: string;
          currency?: string;
          regularMarketPrice?: number;
          previousClose?: number;
          longName?: string;
          shortName?: string;
          exchangeName?: string;
        };
        timestamp?: number[];
        indicators: { quote: Array<{ close?: (number | null)[] }> };
      }>;
    };
  }>;
}

export interface Quote {
  symbol: string;
  price: number;
  previousClose: number;
  currency: string;
  name: string;
  exchange: string;
  dayChangePct: number;
}

export const getQuote = createServerFn({ method: "GET" })
  .inputValidator((data: { symbol: string }) => data)
  .handler(async ({ data }): Promise<Quote> => {
    const j = await fetchYahoo(data.symbol, "5d", "1d");
    const r = j.chart.result?.[0];
    if (!r || j.chart.error) throw new Error(j.chart.error?.description ?? "No data");
    const price = r.meta.regularMarketPrice ?? 0;
    const prev = r.meta.previousClose ?? price;
    return {
      symbol: r.meta.symbol,
      price,
      previousClose: prev,
      currency: r.meta.currency ?? "USD",
      name: r.meta.longName ?? r.meta.shortName ?? r.meta.symbol,
      exchange: r.meta.exchangeName ?? "",
      dayChangePct: prev ? ((price - prev) / prev) * 100 : 0,
    };
  });

export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((data: { symbols: string[] }) => data)
  .handler(async ({ data }): Promise<Record<string, Quote>> => {
    const out: Record<string, Quote> = {};
    await Promise.all(
      data.symbols.map(async (sym) => {
        try {
          const j = await fetchYahoo(sym, "5d", "1d");
          const r = j.chart.result?.[0];
          if (!r) return;
          const price = r.meta.regularMarketPrice ?? 0;
          const prev = r.meta.previousClose ?? price;
          out[sym] = {
            symbol: r.meta.symbol,
            price,
            previousClose: prev,
            currency: r.meta.currency ?? "USD",
            name: r.meta.longName ?? r.meta.shortName ?? sym,
            exchange: r.meta.exchangeName ?? "",
            dayChangePct: prev ? ((price - prev) / prev) * 100 : 0,
          };
        } catch {
          // swallow individual failures; other quotes may still succeed
        }
      }),
    );
    return out;
  });

export interface HistoryPoint {
  date: string;
  close: number;
}

export const getHistory = createServerFn({ method: "GET" })
  .inputValidator((data: { symbol: string; range?: string; interval?: string }) => data)
  .handler(async ({ data }): Promise<{ symbol: string; currency: string; points: HistoryPoint[] }> => {
    const j = await fetchYahoo(data.symbol, data.range ?? "5y", data.interval ?? "1mo");
    const r = j.chart.result?.[0];
    if (!r) throw new Error("No data");
    const ts = r.timestamp ?? [];
    const closes = r.indicators.quote[0]?.close ?? [];
    const points: HistoryPoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (typeof c === "number" && isFinite(c)) {
        points.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: c });
      }
    }
    return { symbol: r.meta.symbol, currency: r.meta.currency ?? "USD", points };
  });

/** FX via Yahoo pair symbol e.g. EURUSD=X returns EUR->USD */
export const getFxRates = createServerFn({ method: "POST" })
  .inputValidator((data: { base: string; symbols: string[] }) => data)
  .handler(async ({ data }): Promise<Record<string, number>> => {
    const out: Record<string, number> = {};
    await Promise.all(
      data.symbols.map(async (sym) => {
        if (sym === data.base) {
          out[sym] = 1;
          return;
        }
        try {
          const pair = `${sym}${data.base}=X`;
          const j = await fetchYahoo(pair, "5d", "1d");
          const r = j.chart.result?.[0];
          const p = r?.meta.regularMarketPrice;
          if (typeof p === "number") out[sym] = p;
        } catch {
          // ignore
        }
      }),
    );
    return out;
  });
