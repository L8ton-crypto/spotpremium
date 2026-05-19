import { DEALERS, DEALER_LABELS, PRODUCT_LABELS } from "@/lib/dealers";
import { ensureDb, sql } from "@/lib/db";
import PremiumChart from "@/components/PremiumChart";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type Row = {
  taken_at: string;
  product: string;
  dealer: string;
  dealer_price: string | number | null;
  spot_price: string | number | null;
  premium_pct: string | number | null;
  status: string;
};

async function loadData() {
  await ensureDb();
  const rows = (await sql`
    SELECT taken_at, product, dealer, dealer_price, spot_price, premium_pct, status
    FROM sp_snapshots
    WHERE taken_at >= NOW() - INTERVAL '7 days' AND status = 'ok'
    ORDER BY taken_at ASC
  `) as Row[];

  const latestRows = (await sql`
    SELECT DISTINCT ON (product, dealer)
      taken_at, product, dealer, dealer_price, spot_price, premium_pct, status, note
    FROM sp_snapshots
    ORDER BY product, dealer, taken_at DESC
  `) as any[];

  return { rows, latestRows };
}

function fmtMoney(n: number | null) {
  if (n == null) return "-";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function fmtPct(n: number | null) {
  if (n == null) return "-";
  return `${n.toFixed(2)}%`;
}

function fmtAgo(iso: string | null) {
  if (!iso) return "no data";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

export default async function Page() {
  const { rows, latestRows } = await loadData();

  const series = rows.map((r) => ({
    takenAt: new Date(r.taken_at).toISOString(),
    product: r.product,
    dealer: r.dealer,
    premiumPct: Number(r.premium_pct)
  }));

  const latestByKey = new Map<string, any>();
  for (const r of latestRows) latestByKey.set(`${r.product}__${r.dealer}`, r);

  const products: ("silver_eagle_1oz" | "gold_eagle_1oz")[] = ["silver_eagle_1oz", "gold_eagle_1oz"];
  const hasData = series.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 rounded-full bg-accent shadow-[0_0_12px_#f59e0b]" />
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">SpotPremium</h1>
        </div>
        <p className="mt-3 text-muted max-w-2xl">
          Live dealer premium over spot for retail bullion. Tracks 1oz American Silver Eagle and 1oz
          American Gold Eagle across APMEX, JM Bullion, SD Bullion and Money Metals. Snapshots are
          taken hourly. Spot is the nearby futures contract.
        </p>
      </header>

      {!hasData && (
        <section className="rounded-xl border border-line bg-panel p-6 mb-10">
          <h2 className="text-lg font-semibold mb-2">No snapshots yet</h2>
          <p className="text-muted text-sm">
            The first snapshot has not run. Trigger it manually by visiting <code className="text-accent">/api/refresh</code>
            with the CRON_SECRET key, or wait for the next hourly cron.
          </p>
        </section>
      )}

      {products.map((p) => {
        const productRows = DEALERS.filter((d) => d.product === p);
        const productSeries = series.filter((s) => s.product === p);
        return (
          <section key={p} className="mb-12">
            <h2 className="text-xl font-semibold mb-4">{PRODUCT_LABELS[p]}</h2>

            <div className="rounded-xl border border-line bg-panel p-4 sm:p-6 mb-4">
              {productSeries.length > 0 ? (
                <PremiumChart series={productSeries} product={p} />
              ) : (
                <p className="text-muted text-sm">No data yet for this product.</p>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-line bg-panel">
              <table className="w-full text-sm tabular">
                <thead className="bg-line/50 text-muted">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Dealer</th>
                    <th className="text-right px-4 py-3 font-medium">Dealer price</th>
                    <th className="text-right px-4 py-3 font-medium">Spot</th>
                    <th className="text-right px-4 py-3 font-medium">Premium</th>
                    <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((d) => {
                    const r = latestByKey.get(`${p}__${d.key}`);
                    const dealerPrice = r ? Number(r.dealer_price) : null;
                    const spot = r ? Number(r.spot_price) : null;
                    const prem = r ? Number(r.premium_pct) : null;
                    return (
                      <tr key={d.key} className="border-t border-line">
                        <td className="px-4 py-3">
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-accent"
                          >
                            {DEALER_LABELS[d.key]}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-right">{fmtMoney(dealerPrice)}</td>
                        <td className="px-4 py-3 text-right">{fmtMoney(spot)}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={
                              prem == null
                                ? "text-muted"
                                : prem > 25
                                ? "text-bad"
                                : prem > 12
                                ? "text-accent"
                                : "text-good"
                            }
                          >
                            {fmtPct(prem)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-muted hidden sm:table-cell">
                          {fmtAgo(r?.taken_at ?? null)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <footer className="mt-12 border-t border-line pt-6 text-xs text-muted">
        <p>
          Premium is calculated as (dealer price - spot) / spot. Spot price is the nearby futures
          contract (SI=F for silver, GC=F for gold) sourced from Yahoo Finance. Dealer prices are
          scraped from public product pages and may lag the dealer site by up to one hour. Not
          financial advice.
        </p>
      </footer>
    </main>
  );
}
