import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const USERS_DB = process.env.NOTION_USERS_DB || "";
const SECRET = process.env.NEXTAUTH_SECRET || "hostyo-default-secret-change-me";

/* eslint-disable @typescript-eslint/no-explicit-any */
function getProp(page: any, name: string): any {
  const p = page.properties?.[name];
  if (!p) return null;
  switch (p.type) {
    case "title": return p.title?.[0]?.plain_text || "";
    case "rich_text": return p.rich_text?.[0]?.plain_text || "";
    case "email": return p.email || "";
    case "checkbox": return p.checkbox ?? false;
    default: return null;
  }
}

// Just check credentials without creating a session
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Email and password required" }, { status: 400 });
    }

    if (!USERS_DB) {
      return NextResponse.json({ ok: false, error: "Not configured" }, { status: 500 });
    }

    const passwordHash = createHash("sha256").update(password + SECRET).digest("hex");

    const res = await notion.databases.query({
      database_id: USERS_DB,
      filter: { property: "Email", email: { equals: email.toLowerCase().trim() } },
      page_size: 1,
    });

    if (res.results.length === 0) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const user = res.results[0] as any;
    const storedHash = getProp(user, "Password");

    if (storedHash !== passwordHash) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const isAdmin = getProp(user, "Is Admin") === true;
    const isApproved = getProp(user, "Approved") === true;

    if (!isAdmin && !isApproved) {
      return NextResponse.json({ ok: false, error: "PENDING_APPROVAL" }, { status: 403 });
    }

    const name = getProp(user, "Full Name") || email.split("@")[0];

    return NextResponse.json({ ok: true, name });
  } catch (error) {
    console.error("Check credentials error:", error);
    return NextResponse.json({ ok: false, error: "Check failed" }, { status: 500 });
  }
}
