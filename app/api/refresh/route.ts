import { NextResponse } from "next/server";
import { ensureDb, sql } from "@/lib/db";
import { DEALERS } from "@/lib/dealers";
import { fetchSpot } from "@/lib/spot";
import { scrapeDealer } from "@/lib/scrape";
import type { Metal } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function takeSnapshot() {
  await ensureDb();

  const [silver, gold] = await Promise.all([fetchSpot("silver"), fetchSpot("gold")]);
  const spots: Record<Metal, number | null> = { silver, gold };

  const results = await Promise.all(
    DEALERS.map(async (d) => {
      const spot = spots[d.metal];
      if (spot == null) {
        await sql`
          INSERT INTO sp_snapshots (product, dealer, dealer_price, spot_price, premium_pct, status, note)
          VALUES (${d.product}, ${d.key}, NULL, NULL, NULL, 'spot_error', 'spot fetch failed')
        `;
        return { dealer: d.key, product: d.product, status: "spot_error" as const };
      }

      const r = await scrapeDealer(d);
      if (!r.ok) {
        await sql`
          INSERT INTO sp_snapshots (product, dealer, dealer_price, spot_price, premium_pct, status, note)
          VALUES (${d.product}, ${d.key}, NULL, ${spot}, NULL, 'scrape_error', ${r.error})
        `;
        return {
          dealer: d.key,
          product: d.product,
          status: "scrape_error" as const,
          error: r.error
        };
      }

      const premium = ((r.price - spot) / spot) * 100;
      await sql`
        INSERT INTO sp_snapshots (product, dealer, dealer_price, spot_price, premium_pct, status, note)
        VALUES (${d.product}, ${d.key}, ${r.price}, ${spot}, ${premium}, 'ok', ${r.source})
      `;
      return {
        dealer: d.key,
        product: d.product,
        status: "ok" as const,
        dealerPrice: r.price,
        spot,
        premiumPct: Number(premium.toFixed(3)),
        source: r.source
      };
    })
  );

  return { takenAt: new Date().toISOString(), spots, results };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("key") ?? "";
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const out = await takeSnapshot();
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "snapshot_failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
