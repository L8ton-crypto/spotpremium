# SpotPremium

Live dealer premium-over-spot tracker for retail bullion. Watches 1oz American Silver Eagle and 1oz American Gold Eagle across APMEX, JM Bullion, SD Bullion and Money Metals.

Premium widening is a tradeable signal for the physical retail market. This tool exposes the time series so you can see when dealers start charging more without spot moving.

## Stack

- Next.js 14 (app router) + TypeScript
- Tailwind, dark mode, mobile-first
- Neon serverless Postgres for snapshot storage
- Chart.js for the premium chart
- Vercel cron for the daily baseline + lazy refresh on page visits
- @vercel/analytics + @vercel/speed-insights

## Architecture

```
GET  /                    Server-rendered chart + table per product
GET  /api/snapshots       Read snapshots (default last 7 days). Triggers a
                          background refresh if the newest snapshot is over 30
                          minutes old.
GET  /api/refresh         Trigger a fresh snapshot (CRON_SECRET required).
                          Also called by the Vercel cron once per day.
GET  /api/spot            Debug endpoint: current spot for silver and gold.
```

### Refresh model

Two refresh paths feed the same database:

1. Vercel cron hits `/api/refresh` once per day at 06:00 UTC. This is the baseline that always runs, even if no one visits the site.
2. Page visits (or anyone hitting `/api/snapshots`) trigger a background refresh if the newest successful snapshot is more than 30 minutes old. The visitor still gets the previous snapshot immediately, no waiting.

Together these give frequent updates while the site is being used, without spending a cron slot per hour.

## Scraping

Each scrape tries three strategies in order:

1. JSON-LD `Product.offers.price` (most reliable)
2. `<meta itemprop="price">`, `product:price:amount`, or `og:price:amount`
3. Regex fallback over the first 60KB of HTML with metal-specific sanity bounds

Sanity bounds reject prices outside plausible ranges per product class so a banner figure does not pollute the data. Failed scrapes are written to the DB as `scrape_error` with the failure reason in `note`. A 15-second timeout per dealer keeps the refresh under the function timeout budget.

## Env

```
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
CRON_SECRET=long-random-string
```

## Data model

```
sp_snapshots (
  id           SERIAL PRIMARY KEY,
  taken_at     TIMESTAMPTZ DEFAULT NOW(),
  product      TEXT,
  dealer       TEXT,
  dealer_price NUMERIC(10,2),
  spot_price   NUMERIC(10,2),
  premium_pct  NUMERIC(8,3),
  status       TEXT,        -- ok | scrape_error | spot_error
  note         TEXT         -- source tag for ok, error reason otherwise
)
```

## Local dev

```bash
npm install
echo "DATABASE_URL=..." > .env.local
echo "CRON_SECRET=anything" >> .env.local
npm run dev
# Then curl 'http://localhost:3000/api/refresh?key=anything' to take a snapshot
```

## Notes

- Spot is the nearby futures contract (SI=F for silver, GC=F for gold) from Yahoo Finance, not LBMA spot. Difference is typically under 0.5% for nearby contracts.
- Some dealers (APMEX, JM Bullion) sit behind Cloudflare. Scrapes may intermittently fail. The table shows the last successful snapshot.
- Premium thresholds in the table: green under 12%, amber 12-25%, red over 25%.
- Not financial advice.
