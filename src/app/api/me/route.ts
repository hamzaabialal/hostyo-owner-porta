import { NextRequest, NextResponse } from "next/server";
import { getUserScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

/** GET /api/me — returns current scope + impersonation status for the UI. */
export async function GET(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    ok: true,
    email: scope.email,
    isAdmin: scope.isAdmin,
    isImpersonating: !!scope.isImpersonating,
    realEmail: scope.realEmail || null,
  });
}
