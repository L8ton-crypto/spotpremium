import type { DealerConfig } from "./types";

// One canonical product URL per dealer per product class.
// 1oz American Silver Eagle BU (current mint year) and 1oz American Gold Eagle BU.
//
// homepageUrl is used for cookie warm-up on dealers behind Cloudflare/Akamai.
// aggregatorSlug is the findbullionprices.com dealer slug used by the fallback
// scraper. findbullionprices.com aggregates retail bullion prices across the
// same dealers and is a workable secondary source when the direct dealer page
// is blocked.
export const DEALERS: DealerConfig[] = [
  {
    key: "apmex",
    name: "APMEX",
    metal: "silver",
    product: "silver_eagle_1oz",
    url: "https://www.apmex.com/product/293817/2025-1-oz-american-silver-eagle-bu",
    homepageUrl: "https://www.apmex.com/",
    aggregatorSlug: "apmex"
  },
  {
    key: "jm_bullion",
    name: "JM Bullion",
    metal: "silver",
    product: "silver_eagle_1oz",
    url: "https://www.jmbullion.com/2025-1-oz-american-silver-eagle-coin/",
    homepageUrl: "https://www.jmbullion.com/",
    aggregatorSlug: "jm-bullion"
  },
  {
    key: "sd_bullion",
    name: "SD Bullion",
    metal: "silver",
    product: "silver_eagle_1oz",
    // Refreshed 2026-05-22. Previous /2025-american-silver-eagle-coin-1oz returned 404.
    // SD Bullion canonical pattern is /<year>-1-oz-american-silver-eagle-coin.
    url: "https://sdbullion.com/2026-1-oz-american-silver-eagle-coin",
    homepageUrl: "https://sdbullion.com/",
    aggregatorSlug: "sd-bullion"
  },
  {
    key: "money_metals",
    name: "Money Metals",
    metal: "silver",
    product: "silver_eagle_1oz",
    url: "https://www.moneymetals.com/buy/silver/silver-eagles/2025-1-oz-silver-eagle-coin",
    homepageUrl: "https://www.moneymetals.com/",
    aggregatorSlug: "money-metals"
  },
  {
    key: "apmex",
    name: "APMEX",
    metal: "gold",
    product: "gold_eagle_1oz",
    url: "https://www.apmex.com/product/293816/2025-1-oz-gold-american-eagle-bu",
    homepageUrl: "https://www.apmex.com/",
    aggregatorSlug: "apmex"
  },
  {
    key: "jm_bullion",
    name: "JM Bullion",
    metal: "gold",
    product: "gold_eagle_1oz",
    url: "https://www.jmbullion.com/2025-1-oz-american-gold-eagle-coin/",
    homepageUrl: "https://www.jmbullion.com/",
    aggregatorSlug: "jm-bullion"
  },
  {
    key: "sd_bullion",
    name: "SD Bullion",
    metal: "gold",
    product: "gold_eagle_1oz",
    // Refreshed 2026-05-22. Previous /1-oz-american-gold-eagle-coin-2025 returned 404.
    url: "https://sdbullion.com/2026-1-oz-american-gold-eagle-coin",
    homepageUrl: "https://sdbullion.com/",
    aggregatorSlug: "sd-bullion"
  },
  {
    key: "money_metals",
    name: "Money Metals",
    metal: "gold",
    product: "gold_eagle_1oz",
    url: "https://www.moneymetals.com/buy/gold/gold-eagles/1-oz-american-gold-eagle-coin-bu",
    homepageUrl: "https://www.moneymetals.com/",
    aggregatorSlug: "money-metals"
  }
];

export const PRODUCT_LABELS: Record<string, string> = {
  silver_eagle_1oz: "1oz American Silver Eagle",
  gold_eagle_1oz: "1oz American Gold Eagle"
};

export const DEALER_LABELS: Record<string, string> = {
  apmex: "APMEX",
  jm_bullion: "JM Bullion",
  sd_bullion: "SD Bullion",
  money_metals: "Money Metals"
};

// findbullionprices.com product paths, used by the aggregator fallback.
export const AGGREGATOR_PATHS: Record<string, string> = {
  silver_eagle_1oz: "https://findbullionprices.com/silver-bullion/silver-american-eagle-1-oz",
  gold_eagle_1oz: "https://findbullionprices.com/gold-bullion/gold-american-eagle-1-oz"
};
