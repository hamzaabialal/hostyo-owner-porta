/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Client } from "@notionhq/client";
import { IMPERSONATE_COOKIE, IMPERSONATE_MAX_AGE_SEC, signImpersonation } from "@/lib/impersonation";

export const dynamic = "force-dynamic";

const SECRET = process.env.NEXTAUTH_SECRET || "hostyo-default-secret-change-me";
const USERS_DB = process.env.NOTION_USERS_DB || "";

/**
 * POST /api/impersonate
 *   body: { email: string }
 *   Starts impersonating the given user. Caller must be an admin, and the
 *   target user must exist and NOT be another admin.
 */
export async function POST(req: NextRequest) {
  try {
    // Read the raw token directly — we must NOT go through getUserScope here,
    // because that would allow stacked impersonation (admin-as-X impersonating Y).
    const token = await getToken({ req, secret: SECRET });
    if (!token || !token.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const realRole = (token.role as string) || "owner";
    if (realRole !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }
    const realEmail = (token.email as string).toLowerCase();

    const body = await req.json();
    const targetEmail = String(body?.email || "").toLowerCase().trim();
    if (!targetEmail) return NextResponse.json({ error: "email required" }, { status: 400 });
    if (targetEmail === realEmail) {
      return NextResponse.json({ error: "Cannot impersonate yourself" }, { status: 400 });
    }
    if (!USERS_DB) return NextResponse.json({ error: "Users database not configured" }, { status: 500 });

    // Look up the target user to confirm existence and that they're not an admin.
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const res: any = await notion.databases.query({
      database_id: USERS_DB,
      filter: { property: "Email", email: { equals: targetEmail } },
      page_size: 1,
    });
    const page = res.results?.[0];
    if (!page) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const targetIsAdmin = page.properties?.["Is Admin"]?.checkbox === true;
    const targetName = page.properties?.["Full Name"]?.title?.[0]?.plain_text || targetEmail;
    if (targetIsAdmin) {
      return NextResponse.json({ error: "Cannot impersonate another admin" }, { status: 403 });
    }

    // Audit log (server-side only)
    console.log(`[impersonate] admin=${realEmail} → target=${targetEmail}`);

    const value = signImpersonation(targetEmail);
    const resp = NextResponse.json({ ok: true, target: { email: targetEmail, name: targetName } });
    resp.cookies.set({
      name: IMPERSONATE_COOKIE,
      value,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: IMPERSONATE_MAX_AGE_SEC,
    });
    return resp;
  } catch (err: any) {
    console.error("POST /api/impersonate failed:", err);
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/impersonate — stop impersonating (clear the cookie).
 * Anyone can call this; clearing their own cookie has no privilege effect.
 */
export async function DELETE(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const resp = NextResponse.json({ ok: true });
    resp.cookies.set({
      name: IMPERSONATE_COOKIE,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return resp;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}
