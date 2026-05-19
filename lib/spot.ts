import type { Metal } from "./types";

// Yahoo Finance unofficial chart endpoint. Public, no key required.
// SI=F is silver futures (per troy oz, USD). GC=F is gold futures.
// We use the nearby futures contract as the spot proxy. Difference vs true LBMA
// spot is typically < 0.5% for nearby contracts, which is acceptable for
// premium-over-spot tracking. The displayed label says "spot proxy" to be honest.
const SYMBOLS: Record<Metal, string> = {
  silver: "SI=F",
  gold: "GC=F"
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function fetchSpot(metal: Metal): Promise<number | null> {
  const sym = SYMBOLS[metal];
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
