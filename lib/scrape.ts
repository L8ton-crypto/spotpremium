import type { DealerConfig, ScrapeResult } from "./types";
import { AGGREGATOR_PATHS, DEALER_LABELS } from "./dealers";

// Modern Chrome UA. Several retail bullion sites short-circuit on stale UAs.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Browser-equivalent header bundle. Sent with every fetch. APMEX and Money
// Metals reject thin headers with 403, the full chrome-like bundle gets past
// at least the basic WAF tier.
function chromeHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "User-Agent": UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "sec-ch-ua": '"Chromium";v="126", "Not_A Brand";v="24", "Google Chrome";v="126"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    ...extra
  };
}

// Extract price from JSON-LD Product schema. Handles offers as object or array.
function priceFromJsonLd(html: string): number | null {
  const matches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const m of matches) {
    const raw = m[1].trim();
    try {
      const data = JSON.parse(raw);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const types = ([] as string[]).concat(node?.["@type"] ?? []);
        if (!types.some((t) => /product/i.test(t))) continue;
        const offers = node?.offers;
        const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
        for (const off of offerList) {
          const p = off?.price ?? off?.lowPrice ?? off?.priceSpecification?.price;
          const num = typeof p === "string" ? parseFloat(p) : Number(p);
          if (Number.isFinite(num) && num > 0) return num;
        }
      }
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }
  return null;
}

// Extract price from common meta tags. Tries both attribute orderings.
function priceFromMeta(html: string): number | null {
  const patterns = [
    /<meta[^>]+itemprop=["']price["'][^>]+content=["']([0-9]+(?:\.[0-9]+)?)["']/i,
    /<meta[^>]+content=["']([0-9]+(?:\.[0-9]+)?)["'][^>]+itemprop=["']price["']/i,
    /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([0-9]+(?:\.[0-9]+)?)["']/i,
    /<meta[^>]+content=["']([0-9]+(?:\.[0-9]+)?)["'][^>]+property=["']product:price:amount["']/i,
    /<meta[^>]+property=["']og:price:amount["'][^>]+content=["']([0-9]+(?:\.[0-9]+)?)["']/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

// Last-resort regex: find dollar amounts inside the first 60KB of the page within
// metal-specific sanity bounds. Returns the median of the first five hits to dodge
// banner/header numbers.
function priceFromRegex(html: string, lowerBound: number, upperBound: number): number | null {
  const window = html.slice(0, 60000);
  const dollarRe = /\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/g;
  const candidates: number[] = [];
  for (const m of window.matchAll(dollarRe)) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n >= lowerBound && n <= upperBound) candidates.push(n);
  }
  if (candidates.length === 0) return null;
  const first = candidates.slice(0, 5).sort((a, b) => a - b);
  return first[Math.floor(first.length / 2)];
}

// Sanity bounds vs the metal we are scraping. Stops a header banner figure from
// being misinterpreted as the product price.
const BOUNDS: Record<string, [number, number]> = {
  silver_eagle_1oz: [25, 250],
  gold_eagle_1oz: [1500, 8000]
};

// Read Set-Cookie headers from the homepage fetch and serialize them into a
// single Cookie request header for the subsequent product page fetch. Some
// anti-bot tiers (Akamai sensor, basic Cloudflare clearance) accept a fresh
// cookie set rather than 403'ing every request from a cold session.
function collectCookies(res: Response): string {
  // Headers iteration handles repeated Set-Cookie correctly in Node 18+.
  const pairs: string[] = [];
  
  const sc: string[] | undefined = res.headers.getSetCookie?.();
  if (sc && sc.length) {
    for (const line of sc) {
      const head = line.split(";")[0].trim();
      if (head) pairs.push(head);
    }
  } else {
    // Fallback when getSetCookie is not available.
    const single = res.headers.get("set-cookie");
    if (single) {
      for (const part of single.split(/,(?=[^ ]+=)/)) {
        const head = part.split(";")[0].trim();
        if (head) pairs.push(head);
      }
    }
  }
  return pairs.join("; ");
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Direct scrape: homepage warm-up first, then product page with collected
// cookies and a Referer pointed at the homepage. Falls back through JSON-LD,
// meta tags, then a bounded regex.
async function scrapeDealerDirect(d: DealerConfig): Promise<ScrapeResult> {
  let cookie = "";
  if (d.homepageUrl) {
    try {
      const warm = await fetchWithTimeout(
        d.homepageUrl,
        { headers: chromeHeaders(), cache: "no-store", redirect: "follow" },
        10000
      );
      cookie = collectCookies(warm);
      // Drain body so the connection can be reused under keep-alive.
      try {
        await warm.text();
      } catch {}
    } catch {
      // Warm-up is best-effort. Continue without cookies.
    }
  }

  const referer = d.homepageUrl ?? new URL(d.url).origin + "/";
  const extra: Record<string, string> = {
    Referer: referer,
    "Sec-Fetch-Site": "same-origin"
  };
  if (cookie) extra.Cookie = cookie;

  let html: string;
  try {
    const res = await fetchWithTimeout(
      d.url,
      { headers: chromeHeaders(extra), cache: "no-store", redirect: "follow" },
      15000
    );
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    html = await res.text();
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "timeout" : e?.message ?? "unknown";
    return { ok: false, error: `fetch_failed:${msg}` };
  }

  const [lo, hi] = BOUNDS[d.product];

  const fromLd = priceFromJsonLd(html);
  if (fromLd != null && fromLd >= lo && fromLd <= hi) {
    return { ok: true, price: fromLd, source: "json-ld" };
  }
  const fromMeta = priceFromMeta(html);
  if (fromMeta != null && fromMeta >= lo && fromMeta <= hi) {
    return { ok: true, price: fromMeta, source: "meta" };
  }
  const fromRe = priceFromRegex(html, lo, hi);
  if (fromRe != null) return { ok: true, price: fromRe, source: "regex" };

  return { ok: false, error: "no_price_parsed" };
}

// Aggregator fallback. findbullionprices.com renders a per-dealer table for
// each product class. We pull that page and look for the dealer's name in a
// table row, then read the nearest dollar amount in sanity bounds.
async function scrapeAggregator(d: DealerConfig): Promise<ScrapeResult> {
  const url = AGGREGATOR_PATHS[d.product];
  if (!url || !d.aggregatorSlug) return { ok: false, error: "aggregator_unconfigured" };

  let html: string;
  try {
    const res = await fetchWithTimeout(
      url,
      { headers: chromeHeaders({ Referer: "https://findbullionprices.com/" }), cache: "no-store" },
      15000
    );
    if (!res.ok) return { ok: false, error: `aggregator_http_${res.status}` };
    html = await res.text();
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "timeout" : e?.message ?? "unknown";
    return { ok: false, error: `aggregator_fetch_failed:${msg}` };
  }

  const [lo, hi] = BOUNDS[d.product];
  const label = DEALER_LABELS[d.key] ?? d.name;

  // Find a table row that mentions either the dealer slug or the dealer label.
  // Aggregator markup is a standard <tr>…</tr> with dealer name and price cells.
  const rowRe = /<tr[\s\S]*?<\/tr>/gi;
  const slugRe = new RegExp(d.aggregatorSlug.replace(/-/g, "[- ]"), "i");
  const labelRe = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const dollarRe = /\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/g;

  for (const m of html.matchAll(rowRe)) {
    const row = m[0];
    if (!slugRe.test(row) && !labelRe.test(row)) continue;
    const prices: number[] = [];
    for (const pm of row.matchAll(dollarRe)) {
      const n = parseFloat(pm[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n >= lo && n <= hi) prices.push(n);
    }
    if (prices.length > 0) {
      // Lowest in-row price is the "as low as" / qty 1 figure we want.
      const px = Math.min(...prices);
      return { ok: true, price: px, source: "aggregator" };
    }
  }

  return { ok: false, error: "aggregator_no_match" };
}

// Public entry point. Tries the dealer site directly. If the direct attempt
// fails with anything anti-bot-shaped (403, 404, no_price_parsed, fetch_failed,
// timeout), falls back to the aggregator. Aggregator success is annotated in
// the source field so the health endpoint can show the user which dealers are
// running on the secondary path.
export async function scrapeDealer(d: DealerConfig): Promise<ScrapeResult> {
  const direct = await scrapeDealerDirect(d);
  if (direct.ok) return direct;

  const fallbackTriggers = /^(http_(?:403|404|429|503)|no_price_parsed|fetch_failed|timeout)/;
  if (!fallbackTriggers.test(direct.error)) return direct;

  const agg = await scrapeAggregator(d);
  if (agg.ok) return agg;

  // Surface both failures so the health endpoint shows what was tried.
  return { ok: false, error: `${direct.error}|${agg.error}` };
}
