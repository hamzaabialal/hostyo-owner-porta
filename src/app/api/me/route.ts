/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { getUserScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

const USERS_DB = process.env.NOTION_USERS_DB || "";

/**
 * Looks up the user's display name and profile picture from Notion so the UI
 * can render an accurate identity for the effective user (admin's own info
 * normally; the impersonated user's info during impersonation). Falls back to
 * empty strings if the user record can't be located — the UI degrades to the
 * raw email and an initials avatar.
 */
async function loadDisplay(email: string): Promise<{ name: string; profilePicture: string }> {
  if (!USERS_DB || !email) return { name: "", profilePicture: "" };
  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const res: any = await notion.databases.query({
      database_id: USERS_DB,
      filter: { property: "Email", email: { equals: email.toLowerCase().trim() } },
      page_size: 1,
    });
    const page = res.results?.[0];
    if (!page) return { name: "", profilePicture: "" };
    const name = page.properties?.["Full Name"]?.title?.[0]?.plain_text || "";
    const profilePicture = page.properties?.["Profile Picture"]?.url || "";
    return { name, profilePicture };
  } catch {
    return { name: "", profilePicture: "" };
  }
}

/** GET /api/me — returns current scope + display identity for the UI. */
export async function GET(req: NextRequest) {
  const scope = await getUserScope(req);
  if (!scope) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const display = await loadDisplay(scope.email);
  return NextResponse.json({
    ok: true,
    email: scope.email,
    name: display.name,
    profilePicture: display.profilePicture,
    isAdmin: scope.isAdmin,
    isImpersonating: !!scope.isImpersonating,
    realEmail: scope.realEmail || null,
  });
}
