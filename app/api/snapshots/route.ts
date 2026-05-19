import { NextResponse } from "next/server";
import { ensureDb, sql } from "@/lib/db";
import { DEALERS } from "@/lib/dealers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Return the last N days of snapshots, grouped by product + dealer.
export async function GET(req: Request) {
  await ensureDb();
  const url = new URL(req.url);
  const days = Math.max(1, Math.min(30, parseInt(url.searchParams.get("days") ?? "7", 10)));

  const rows = (await sql`
    SELECT id, taken_at, product, dealer, dealer_price, spot_price, premium_pct, status, note
    FROM sp_snapshots
    WHERE taken_at >= NOW() - (INTERVAL '1 day' * ${days})
    ORDER BY taken_at ASC
  `) as any[];

  const latestByKey = new Map<string, any>();
  for (const r of rows) {
    if (r.status !== "ok") continue;
    const key = `${r.product}__${r.dealer}`;
    const cur = latestByKey.get(key);
    if (!cur || new Date(r.taken_at) > new Date(cur.taken_at)) latestByKey.set(key, r);
  }

  const latest = DEALERS.map((d) => {
    const r = latestByKey.get(`${d.product}__${d.key}`);
    return {
      dealer: d.key,
      dealerName: d.name,
      product: d.product,
      url: d.url,
      takenAt: r?.taken_at ?? null,
      dealerPrice: r ? Number(r.dealer_price) : null,
      spotPrice: r ? Number(r.spot_price) : null,
      premiumPct: r ? Number(r.premium_pct) : null
    };
  });

  return NextResponse.json({
    days,
    count: rows.length,
    latest,
    series: rows
      .filter((r) => r.status === "ok")
      .map((r) => ({
        takenAt: r.taken_at,
        product: r.product,
        dealer: r.dealer,
        premiumPct: Number(r.premium_pct),
        dealerPrice: Number(r.dealer_price),
        spotPrice: Number(r.spot_price)
      }))
  });
}
