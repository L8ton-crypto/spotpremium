export type ProductKey = "silver_eagle_1oz" | "gold_eagle_1oz";
export type DealerKey = "apmex" | "jm_bullion" | "sd_bullion" | "money_metals";
export type Metal = "silver" | "gold";

export type DealerConfig = {
  key: DealerKey;
  name: string;
  url: string;
  product: ProductKey;
  metal: Metal;
};

export type Snapshot = {
  id: number;
  takenAt: string;
  product: ProductKey;
  dealer: DealerKey;
  dealerPriceUsd: number | null;
  spotPriceUsd: number | null;
  premiumPct: number | null;
  status: "ok" | "scrape_error" | "spot_error";
  note: string | null;
};

export type ScrapeResult =
  | { ok: true; price: number; source: "json-ld" | "meta" | "regex" }
  | { ok: false; error: string };
