import { NextResponse } from "next/server";
import { fetchSpot } from "@/lib/spot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [silver, gold] = await Promise.all([fetchSpot("silver"), fetchSpot("gold")]);
  return NextResponse.json({ silver, gold, takenAt: new Date().toISOString() });
}
