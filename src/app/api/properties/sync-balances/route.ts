/**
 * /api/properties/sync-balances
 *
 * Recalculates the live "Balance" for every property in the Notion Properties DB
 * and writes it back to the `Balance` number column on each property page.
 *
 *   POST → manual trigger from the UI button (no auth)
 *   GET  → Vercel Cron entry point (requires Bearer ${CRON_SECRET})
 *
 * Both routes call the same `syncAllPropertyBalances()` helper from
 * `src/lib/sync-balances.ts`. That helper is also used in real time by the
 * expense create/update/delete endpoints to keep balances fresh between
 * cron runs.
 */
import { NextRequest, NextResponse } from "next/server";
import { syncAllPropertyBalances, syncDeficitAdjustments } from "@/lib/sync-balances";
import { getUserScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  // Only admins can trigger a full sync
  if (!scope.isAdmin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const [balanceResult, deficitResult] = await Promise.all([
    syncAllPropertyBalances(),
    syncDeficitAdjustments(),
  ]);
  return NextResponse.json(
    { ...balanceResult, deficit: deficitResult },
    { status: balanceResult.ok ? 200 : 500 }
  );
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const [balanceResult, deficitResult] = await Promise.all([
    syncAllPropertyBalances(),
    syncDeficitAdjustments(),
  ]);
  return NextResponse.json(
    { ...balanceResult, deficit: deficitResult },
    { status: balanceResult.ok ? 200 : 500 }
  );
}
