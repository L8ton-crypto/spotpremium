import type { Metal } from "./types";

// Multi-source spot resolver. We learned that Vercel Lambda egress IPs are
// blocked by Yahoo Finance, so the original SI=F / GC=F path returns null in
// production. We now try cheaper public endpoints first and only fall back to
// Yahoo if the others fail. Each source returns USD per troy ounce.
//
// Sources, in order:
//   1. Stooq CSV (XAGUSD, XAUUSD). Cloud-friendly, no key, sub-second.
//   2. Yahoo Finance chart (SI=F, GC=F). Works locally, blocked on some clouds.
//
// The label shown in the UI is "spot proxy" because nearby futures and Stooq
// XAGUSD/XAUUSD are within ~0.3 percent of LBMA spot.

const STOOQ_SYMBOLS: Record<Metal, string> = {
  silver: "xagusd",
  gold: "xauusd"
};

const YAHOO_SYMBOLS: Record<Metal, string> = {
  silver: "SI=F",
  gold: "GC=F"
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchStooq(metal: Metal): Promise<number | null> {
  const sym = STOOQ_SYMBOLS[metal];
  const url = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlc&h&e=csv`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/csv,text/plain,*/*" },
      cache: "no-store",
      next: { revalidate: 0 }
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Header line then one data row. Close is the 7th comma-separated field.
    // Example: Symbol,Date,Time,Open,High,Low,Close
    //          XAGUSD,2026-05-21,22:00:00,32.45,32.60,32.30,32.55
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return null;
    const cols = lines[1].split(",");
    const close = Number(cols[6]);
    if (Number.isFinite(close) && close > 0) return close;
    return null;
  } catch {
    return null;
  }
}

async function fetchYahoo(metal: Metal): Promise<number | null> {
  const sym = YAHOO_SYMBOLS[metal];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1m&range=1d`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
      next: { revalidate: 0 }
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price === "number" && price > 0) return price;
    return null;
  } catch {
    return null;
  }
}

export async function fetchSpot(metal: Metal): Promise<number | null> {
  const stooq = await fetchStooq(metal);
  if (stooq != null) return stooq;
  return fetchYahoo(metal);
}
