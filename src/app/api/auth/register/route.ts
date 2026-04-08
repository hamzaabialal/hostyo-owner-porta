import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const USERS_DB = process.env.NOTION_USERS_DB || "";

function hashPassword(password: string): string {
  return createHash("sha256").update(password + (process.env.NEXTAUTH_SECRET || "hostyo-default-secret-change-me")).digest("hex");
}

export async function POST(req: Request) {
  if (!USERS_DB) {
    return NextResponse.json({ ok: false, error: "Users database not configured" }, { status: 500 });
  }

  try {
    const { name, email, password } = await req.json();

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ ok: false, error: "All fields are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // Check if email already exists
    const existing = await notion.databases.query({
      database_id: USERS_DB,
      filter: { property: "Email", email: { equals: email.toLowerCase().trim() } },
      page_size: 1,
    });

    if (existing.results.length > 0) {
      return NextResponse.json({ ok: false, error: "An account with this email already exists" }, { status: 400 });
    }

    // Hash the password — never store plain text
    const passwordHash = hashPassword(password);

    // Create user in Notion — pending admin approval
    await notion.pages.create({
      parent: { database_id: USERS_DB },
      properties: {
        "Full Name": { title: [{ text: { content: name.trim() } }] },
        "Email": { email: email.toLowerCase().trim() },
        "Password": { rich_text: [{ text: { content: passwordHash } }] },
        "Is Admin": { checkbox: false },
        "Approved": { checkbox: false },
      },
    });

    return NextResponse.json({ ok: true, pendingApproval: true });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ ok: false, error: "Registration failed" }, { status: 500 });
  }
}
