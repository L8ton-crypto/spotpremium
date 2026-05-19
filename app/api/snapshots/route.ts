import { NextResponse } from "next/server";
import { ensureDb, sql } from "@/lib/db";
import { DEALERS } from "@/lib/dealers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 30 minutes - lazy refresh threshold. Reads will trigger a background refresh
// if the newest successful snapshot is older than this.
const STALE_MS = 30 * 60 * 1000;

async function maybeTriggerLazyRefresh(req: Request) {
  try {
    const rows = (await sql`
      SELECT taken_at FROM sp_snapshots WHERE status = 'ok'
      ORDER BY taken_at DESC LIMIT 1
    `) as { taken_at: string }[];
    const latest = rows[0]?.taken_at ? new Date(rows[0].taken_at).getTime() : 0;
    if (Date.now() - latest < STALE_MS) return;
    const secret = process.env.CRON_SECRET;
    if (!secret) return;
    const origin = new URL(req.url).origin;
    // Fire and forget. Do not await.
    fetch(`${origin}/api/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store"
    }).catch(() => {});
  } catch {
    // best-effort, never block the read
  }
}

export async function GET(req: Request) {
  await ensureDb();
  await maybeTriggerLazyRefresh(req);

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
