import { NextResponse } from "next/server";
import { ensureDb, sql } from "@/lib/db";
import { DEALERS } from "@/lib/dealers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

// Per-dealer health: most recent snapshot (any status) and most recent ok
// snapshot. Drives the dealer status badges in the UI.
//
// Status values returned:
//   ok           - last attempt succeeded and used direct dealer scrape
//   ok_fallback  - last attempt succeeded via findbullionprices.com
//   stale        - last ok snapshot is more than 6 hours old
//   blocked      - last attempt failed (http_403/404 or no_price_parsed)
//   spot_error   - last attempt failed because spot lookup itself failed
//   no_data      - no snapshots yet
export async function GET() {
  await ensureDb();

  // Pull last 7 days of all-statuses, post-process in JS. Matches the working
  // pattern in /api/snapshots. DISTINCT ON appeared to return stale rows under
  // some pooler conditions; explicit JS scan is unambiguous.
  const rows = (await sql`
    SELECT taken_at, product, dealer, status, note, dealer_price
    FROM sp_snapshots
    WHERE taken_at >= NOW() - INTERVAL '7 days'
    ORDER BY taken_at DESC
  `) as any[];

  const lastAnyMap = new Map<string, any>();
  const lastOkMap = new Map<string, any>();
  for (const r of rows) {
    const key = `${r.product}__${r.dealer}`;
    if (!lastAnyMap.has(key)) lastAnyMap.set(key, r);
    if (r.status === "ok" && !lastOkMap.has(key)) lastOkMap.set(key, r);
  }

  const STALE_MS = 6 * 60 * 60 * 1000;
  const now = Date.now();

  const dealers = DEALERS.map((d) => {
    const key = `${d.product}__${d.key}`;
    const recent = lastAnyMap.get(key);
    const ok = lastOkMap.get(key);
    const recentNote = recent?.note ?? null;
    const lastOkAt = ok?.taken_at ?? null;
    const okAgeMs = lastOkAt ? now - new Date(lastOkAt).getTime() : null;

    let status: string;
    if (!recent) {
      status = "no_data";
    } else if (recent.status === "ok") {
      status = recentNote === "aggregator" ? "ok_fallback" : "ok";
      if (okAgeMs != null && okAgeMs > STALE_MS) status = "stale";
    } else if (recent.status === "spot_error") {
      status = "spot_error";
    } else {
      status = "blocked";
    }

    return {
      dealer: d.key,
      dealerName: d.name,
      product: d.product,
      status,
      lastAttemptAt: recent?.taken_at ?? null,
      lastAttemptStatus: recent?.status ?? null,
      lastAttemptError: recent?.status !== "ok" ? recentNote : null,
      lastOkAt,
      lastOkSource: ok?.note ?? null,
      lastDealerPrice: recent?.dealer_price != null ? Number(recent.dealer_price) : null
    };
  });

  return NextResponse.json({
    generatedAt: new Date(now).toISOString(),
    rowsScanned: rows.length,
    dealers
  });
}
