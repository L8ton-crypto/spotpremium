import type { DealerConfig } from "./types";

// One canonical product URL per dealer per product class.
// 1oz American Silver Eagle BU (current mint year) and 1oz American Gold Eagle BU.
export const DEALERS: DealerConfig[] = [
  {
    key: "apmex",
    name: "APMEX",
    metal: "silver",
    product: "silver_eagle_1oz",
    url: "https://www.apmex.com/product/293817/2025-1-oz-american-silver-eagle-bu"
  },
  {
    key: "jm_bullion",
    name: "JM Bullion",
    metal: "silver",
    product: "silver_eagle_1oz",
    url: "https://www.jmbullion.com/2025-1-oz-american-silver-eagle-coin/"
  },
  {
    key: "sd_bullion",
    name: "SD Bullion",
    metal: "silver",
    product: "silver_eagle_1oz",
    url: "https://sdbullion.com/2025-american-silver-eagle-coin-1oz"
  },
  {
    key: "money_metals",
    name: "Money Metals",
    metal: "silver",
    product: "silver_eagle_1oz",
    url: "https://www.moneymetals.com/buy/silver/silver-eagles/2025-1-oz-silver-eagle-coin"
  },
  {
    key: "apmex",
    name: "APMEX",
    metal: "gold",
    product: "gold_eagle_1oz",
    url: "https://www.apmex.com/product/293816/2025-1-oz-gold-american-eagle-bu"
  },
  {
    key: "jm_bullion",
    name: "JM Bullion",
    metal: "gold",
    product: "gold_eagle_1oz",
    url: "https://www.jmbullion.com/2025-1-oz-american-gold-eagle-coin/"
  },
  {
    key: "sd_bullion",
    name: "SD Bullion",
    metal: "gold",
    product: "gold_eagle_1oz",
    url: "https://sdbullion.com/1-oz-american-gold-eagle-coin-2025"
  },
  {
    key: "money_metals",
    name: "Money Metals",
    metal: "gold",
    product: "gold_eagle_1oz",
    url: "https://www.moneymetals.com/buy/gold/gold-eagles/1-oz-american-gold-eagle-coin-bu"
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
