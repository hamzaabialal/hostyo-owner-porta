/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const USERS_DB = process.env.NOTION_USERS_DB || "";

function getProp(page: any, name: string): any {
  const p = page.properties?.[name];
  if (!p) return null;
  switch (p.type) {
    case "title": return p.title?.[0]?.plain_text || "";
    case "rich_text": return p.rich_text?.[0]?.plain_text || "";
    case "email": return p.email || "";
    case "checkbox": return p.checkbox ?? false;
    case "phone_number": return p.phone_number || "";
    case "number": return p.number;
    default: return null;
  }
}

// GET — list all users
export async function GET() {
  if (!USERS_DB) {
    return NextResponse.json({ ok: false, error: "Users database not configured" }, { status: 500 });
  }

  try {
    const allPages: any[] = [];
    let cursor: string | undefined;
    do {
      const res: any = await notion.databases.query({
        database_id: USERS_DB,
        start_cursor: cursor,
        page_size: 100,
      });
      allPages.push(...res.results);
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    const users = allPages.map((page: any) => ({
      id: page.id,
      name: getProp(page, "Full Name") || "",
      email: getProp(page, "Email") || "",
      phone: getProp(page, "Phone") || "",
      isAdmin: getProp(page, "Is Admin") === true,
      approved: getProp(page, "Approved") === true,
      properties: getProp(page, "Properties") || "",
      createdAt: page.created_time || "",
    }));

    return NextResponse.json({ ok: true, users });
  } catch (error: any) {
    console.error("Users fetch error:", error?.message);
    return NextResponse.json({ ok: false, error: error?.message || "Failed to fetch users" }, { status: 500 });
  }
}

// POST — invite/create new user
export async function POST(req: Request) {
  if (!USERS_DB) {
    return NextResponse.json({ ok: false, error: "Users database not configured" }, { status: 500 });
  }

  try {
    const { name, email, role, properties } = await req.json();

    if (!email?.trim()) {
      return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 });
    }

    // Check if user already exists
    const existing = await notion.databases.query({
      database_id: USERS_DB,
      filter: { property: "Email", email: { equals: email.toLowerCase().trim() } },
      page_size: 1,
    });

    if (existing.results.length > 0) {
      return NextResponse.json({ ok: false, error: "User with this email already exists" }, { status: 400 });
    }

    // Create user with a temporary password
    const { createHash } = await import("crypto");
    const SECRET = process.env.NEXTAUTH_SECRET || "hostyo-default-secret-change-me";
    const tempPassword = Math.random().toString(36).slice(2, 10);
    const passwordHash = createHash("sha256").update(tempPassword + SECRET).digest("hex");

    const props: any = {
      "Full Name": { title: [{ text: { content: (name || "").trim() || email.split("@")[0] } }] },
      "Email": { email: email.toLowerCase().trim() },
      "Password": { rich_text: [{ text: { content: passwordHash } }] },
      "Is Admin": { checkbox: role === "admin" },
    };

    if (properties) {
      props["Properties"] = { rich_text: [{ text: { content: properties } }] };
    }

    await notion.pages.create({
      parent: { database_id: USERS_DB },
      properties: props,
    });

    return NextResponse.json({ ok: true, tempPassword });
  } catch (error: any) {
    console.error("User create error:", error?.message);
    return NextResponse.json({ ok: false, error: error?.message || "Failed to create user" }, { status: 500 });
  }
}
