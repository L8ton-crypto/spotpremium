import type { DealerConfig, ScrapeResult } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

export async function scrapeDealer(d: DealerConfig): Promise<ScrapeResult> {
  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(d.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      },
      cache: "no-store",
      next: { revalidate: 0 }
    });
    clearTimeout(timeout);
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
