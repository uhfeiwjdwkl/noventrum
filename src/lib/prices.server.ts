/**
 * Market data adapters with a fallback chain.
 *
 *   1. Yahoo Finance  (primary — richest coverage, unofficial JSON API)
 *   2. Stooq CSV      (free, no key, stable; stocks/ETFs/indices/FX)
 *   3. Google Finance (quote-page scrape — last resort, fragile)
 *
 * Everything here is server-only; the browser cannot call these hosts
 * directly because of CORS.
 */

const UA =
  "Mozilla/5.0 (compatible; Noventrum/1.0; +https://noventrum.kommenszlapf.website)";

export type PriceSource = "yahoo" | "stooq" | "google";

export interface RawQuote {
  symbol: string;
  price: number;
  previousClose: number;
  currency: string;
  name: string;
  exchange: string;
  dayChangePct: number;
  source: PriceSource;
}

export interface RawPoint {
  date: string;
  close: number;
}

async function get(url: string, accept = "application/json") {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res;
}

/* ------------------------------- Yahoo -------------------------------- */

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/";

interface YahooChart {
  chart: {
    error?: { code: string; description: string } | null;
    result?: Array<{
      meta: {
        symbol: string;
        currency?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        longName?: string;
        shortName?: string;
        exchangeName?: string;
      };
      timestamp?: number[];
      indicators: { quote: Array<{ close?: (number | null)[] }> };
    }>;
  };
}

export async function yahooChart(symbol: string, range: string, interval: string) {
  const url = `${YAHOO_CHART}${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await get(url);
  const j = (await res.json()) as YahooChart;
  if (j.chart.error) throw new Error(j.chart.error.description);
  const r = j.chart.result?.[0];
  if (!r) throw new Error("no result");
  return r;
}

async function yahooQuote(symbol: string): Promise<RawQuote> {
  const r = await yahooChart(symbol, "5d", "1d");
  const price = r.meta.regularMarketPrice ?? 0;
  if (!price) throw new Error("no price");
  const prev = r.meta.previousClose ?? r.meta.chartPreviousClose ?? price;
  return {
    symbol: r.meta.symbol,
    price,
    previousClose: prev,
    currency: r.meta.currency ?? "USD",
    name: r.meta.longName ?? r.meta.shortName ?? r.meta.symbol,
    exchange: r.meta.exchangeName ?? "",
    dayChangePct: prev ? ((price - prev) / prev) * 100 : 0,
    source: "yahoo",
  };
}

async function yahooHistory(symbol: string, range: string, interval: string) {
  const r = await yahooChart(symbol, range, interval);
  const ts = r.timestamp ?? [];
  const closes = r.indicators.quote[0]?.close ?? [];
  const points: RawPoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (typeof c === "number" && isFinite(c)) {
      points.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: c });
    }
  }
  if (points.length === 0) throw new Error("no points");
  return { currency: r.meta.currency ?? "USD", points, source: "yahoo" as PriceSource };
}

/* ------------------------------- Stooq -------------------------------- */

/** Yahoo-style symbols mapped onto Stooq's naming. */
export function toStooq(symbol: string): string {
  const s = symbol.trim().toLowerCase();
  if (s.endsWith("=x")) return s.slice(0, -2).replace(/[^a-z]/g, ""); // EURUSD=X -> eurusd
  if (s.startsWith("^")) return s.replace("^", "^"); // indices best-effort
  if (s.endsWith("-usd")) return s.replace("-usd", "usd"); // BTC-USD -> btcusd
  if (s.includes(".")) return s; // AIR.PA etc — already exchange-suffixed
  return `${s}.us`;
}

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0]?.split(",") ?? [];
  return lines.slice(1).map((l) => {
    const cells = l.split(",");
    const row: Record<string, string> = {};
    head.forEach((h, i) => (row[h.trim().toLowerCase()] = (cells[i] ?? "").trim()));
    return row;
  });
}

async function stooqQuote(symbol: string): Promise<RawQuote> {
  const s = toStooq(symbol);
  const res = await get(
    `https://stooq.com/q/l/?s=${encodeURIComponent(s)}&f=sd2t2ohlcv&h&e=csv`,
    "text/csv",
  );
  const rows = parseCsv(await res.text());
  const row = rows[0];
  const close = Number(row?.["close"]);
  if (!row || !isFinite(close) || close <= 0) throw new Error("stooq: no data");
  const open = Number(row["open"]);
  return {
    symbol: symbol.toUpperCase(),
    price: close,
    previousClose: isFinite(open) && open > 0 ? open : close,
    currency: guessCurrency(symbol),
    name: symbol.toUpperCase(),
    exchange: "",
    dayChangePct: isFinite(open) && open > 0 ? ((close - open) / open) * 100 : 0,
    source: "stooq",
  };
}

async function stooqHistory(symbol: string, interval: string) {
  const i = interval.includes("mo") ? "m" : interval.includes("wk") ? "w" : "d";
  const res = await get(
    `https://stooq.com/q/d/l/?s=${encodeURIComponent(toStooq(symbol))}&i=${i}`,
    "text/csv",
  );
  const rows = parseCsv(await res.text());
  const points: RawPoint[] = [];
  for (const r of rows) {
    const close = Number(r["close"]);
    if (r["date"] && isFinite(close)) points.push({ date: r["date"], close });
  }
  if (points.length === 0) throw new Error("stooq: no history");
  return { currency: guessCurrency(symbol), points, source: "stooq" as PriceSource };
}

function guessCurrency(symbol: string) {
  const s = symbol.toUpperCase();
  if (s.endsWith("=X")) return s.slice(3, 6) || "USD";
  if (s.endsWith(".AX")) return "AUD";
  if (s.endsWith(".L")) return "GBP";
  if (s.endsWith(".TO")) return "CAD";
  if (s.endsWith(".DE") || s.endsWith(".PA") || s.endsWith(".AS")) return "EUR";
  if (s.endsWith(".T")) return "JPY";
  return "USD";
}

/* --------------------------- Google Finance ---------------------------- */

/**
 * Google publishes no API. The quote page embeds the price in a
 * `data-last-price` attribute — good enough as a final fallback, but it can
 * break without notice, so it is only tried after Yahoo and Stooq.
 */
async function googleQuote(symbol: string): Promise<RawQuote> {
  const s = symbol.trim().toUpperCase();
  const candidates = s.endsWith("=X")
    ? [`${s.slice(0, 3)}-${s.slice(3, 6)}`]
    : s.endsWith("-USD")
      ? [`${s.replace("-USD", "")}-USD`]
      : [`${s}:NASDAQ`, `${s}:NYSE`, `${s}:NYSEARCA`, `${s}:ASX`, `${s}:LON`];

  for (const c of candidates) {
    try {
      const res = await get(
        `https://www.google.com/finance/quote/${encodeURIComponent(c).replace("%3A", ":")}?hl=en`,
        "text/html",
      );
      const html = await res.text();
      const price = Number(/data-last-price="([\d.]+)"/.exec(html)?.[1]);
      if (!isFinite(price) || price <= 0) continue;
      const currency = /data-currency-code="([A-Z]{3})"/.exec(html)?.[1] ?? guessCurrency(s);
      const prev = Number(/Previous close[\s\S]{0,400}?>[^\d<]*([\d,.]+)</.exec(html)?.[1]?.replace(/,/g, ""));
      const previousClose = isFinite(prev) && prev > 0 ? prev : price;
      const name = /<div class="zzDege">([^<]+)</.exec(html)?.[1] ?? s;
      return {
        symbol: s,
        price,
        previousClose,
        currency,
        name,
        exchange: c.split(":")[1] ?? "",
        dayChangePct: previousClose ? ((price - previousClose) / previousClose) * 100 : 0,
        source: "google",
      };
    } catch {
      // try the next exchange guess
    }
  }
  throw new Error("google: no data");
}

/* --------------------------- Fallback chains --------------------------- */

export async function quoteWithFallback(symbol: string): Promise<RawQuote> {
  const chain = [yahooQuote, stooqQuote, googleQuote];
  let lastErr: unknown;
  for (const fn of chain) {
    try {
      return await fn(symbol);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`No price source for ${symbol}: ${String(lastErr)}`);
}

export async function historyWithFallback(symbol: string, range: string, interval: string) {
  try {
    return await yahooHistory(symbol, range, interval);
  } catch {
    return await stooqHistory(symbol, interval);
  }
}

/** Rate to convert 1 `from` into `to`. */
export async function fxRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const q = await quoteWithFallback(`${from}${to}=X`);
  return q.price;
}

/** Historical rate for 1 `from` in `to` on (or just before) an ISO date. */
export async function fxRateAt(from: string, to: string, date: string): Promise<number> {
  if (from === to) return 1;
  const days = Math.max(
    7,
    Math.ceil((Date.now() - new Date(date).getTime()) / 86_400_000) + 10,
  );
  const range = days > 3650 ? "max" : days > 1825 ? "10y" : days > 365 ? "5y" : days > 90 ? "1y" : "6mo";
  const interval = days > 365 ? "1wk" : "1d";
  const { points } = await historyWithFallback(`${from}${to}=X`, range, interval);
  const before = [...points].reverse().find((p) => p.date <= date);
  const rate = before?.close ?? points[points.length - 1]?.close;
  if (!rate) throw new Error("no historical rate");
  return rate;
}

/* ------------------------------- Search -------------------------------- */

export interface RawMatch {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export async function searchYahoo(query: string): Promise<RawMatch[]> {
  const url =
    "https://query1.finance.yahoo.com/v1/finance/search?q=" +
    encodeURIComponent(query) +
    "&quotesCount=12&newsCount=0&listsCount=0&enableFuzzyQuery=true";
  const res = await get(url);
  const j = (await res.json()) as {
    quotes?: Array<{
      symbol?: string;
      shortname?: string;
      longname?: string;
      exchDisp?: string;
      exchange?: string;
      quoteType?: string;
      typeDisp?: string;
      isYahooFinance?: boolean;
    }>;
  };
  return (j.quotes ?? [])
    .filter((x) => x.symbol)
    .map((x) => ({
      symbol: x.symbol!,
      name: x.longname ?? x.shortname ?? x.symbol!,
      exchange: x.exchDisp ?? x.exchange ?? "",
      type: (x.typeDisp ?? x.quoteType ?? "").toString(),
    }));
}
