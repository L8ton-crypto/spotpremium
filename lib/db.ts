import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

let ensured = false;
let ensuring: Promise<void> | null = null;

export async function ensureDb(): Promise<void> {
  if (ensured) return;
  if (ensuring) return ensuring;
  ensuring = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS sp_snapshots (
        id           SERIAL PRIMARY KEY,
        taken_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        product      TEXT NOT NULL,
        dealer       TEXT NOT NULL,
        dealer_price NUMERIC(10,2),
        spot_price   NUMERIC(10,2),
        premium_pct  NUMERIC(8,3),
        status       TEXT NOT NULL,
        note         TEXT
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS sp_snapshots_lookup ON sp_snapshots (product, dealer, taken_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS sp_snapshots_recent ON sp_snapshots (taken_at DESC)`;
    ensured = true;
  })();
  return ensuring;
}

export { sql };
