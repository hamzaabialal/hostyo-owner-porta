/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Client } from "@notionhq/client";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const USERS_DB = process.env.NOTION_USERS_DB || "";
const SECRET = process.env.NEXTAUTH_SECRET || "hostyo-default-secret-change-me";

function hashPassword(password: string): string {
  return createHash("sha256").update(password + SECRET).digest("hex");
}

function getProp(page: any, name: string): any {
  const p = page.properties?.[name];
  if (!p) return null;
  switch (p.type) {
    case "title": return p.title?.[0]?.plain_text || "";
    case "rich_text": return p.rich_text?.[0]?.plain_text || "";
    case "email": return p.email || "";
    case "phone_number": return p.phone_number || "";
    case "checkbox": return p.checkbox ?? false;
    default: return null;
  }
}

async function getEmailFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const token = await getToken({ req, secret: SECRET });
    if (token?.email) return token.email as string;
  } catch (e) {
    console.log("[profile] getToken failed:", e);
  }

  // Fallback for settings page — read from query param only if authenticated via middleware
  const url = new URL(req.url);
  const emailParam = url.searchParams.get("email");
  if (emailParam) return emailParam;

  return null;
}

async function findUserPage(email: string) {
  if (!USERS_DB || !email) return null;
  const res = await notion.databases.query({
    database_id: USERS_DB,
    filter: { property: "Email", email: { equals: email.toLowerCase().trim() } },
    page_size: 1,
  });
  return res.results[0] || null;
}

/* ── GET: Fetch profile ── */
export async function GET(req: NextRequest) {
  try {
    const email = await getEmailFromRequest(req);
    console.log("[profile GET] email:", email, "| USERS_DB set:", !!USERS_DB);
    if (!email) {
      return NextResponse.json({ ok: false, error: "Not authenticated - no email found" }, { status: 401 });
    }

    const page = await findUserPage(email);
    if (!page) {
      return NextResponse.json({ ok: false, error: `User not found for ${email}` }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      profile: {
        id: page.id,
        fullName: getProp(page, "Full Name") || "",
        email: getProp(page, "Email") || "",
        phone: getProp(page, "Phone") || "",
        iban: getProp(page, "IBAN") || "",
        bic: getProp(page, "BIC") || "",
        beneficiary: getProp(page, "Beneficiary Name") || "",
        payoutMethod: getProp(page, "Payout Method") || "Bank Transfer",
        legalName: getProp(page, "Legal Name") || "",
        billingAddress: getProp(page, "Billing Address") || "",
      },
    });
  } catch (error: any) {
    console.error("Profile fetch error:", error?.body || error?.message || error);
    const msg = error?.body?.message || error?.message || "Failed to fetch profile";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/* ── PATCH: Update profile ── */
export async function PATCH(req: NextRequest) {
  try {
    // Clone request for token check before reading body
    const email = await (async () => {
      try {
        const token = await getToken({ req, secret: SECRET });
        if (token?.email) return token.email as string;
      } catch { /* fallback below */ }
      return null;
    })();

    const body = await req.json();

    // Use email from token, or from body as fallback
    const userEmail = email || body.email;
    console.log("[profile PATCH] email:", userEmail);

    if (!userEmail) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const page = await findUserPage(userEmail);
    if (!page) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const properties: Record<string, any> = {};

    // Profile fields
    if (body.fullName !== undefined) {
      properties["Full Name"] = { title: [{ text: { content: body.fullName.trim() } }] };
    }
    if (body.phone !== undefined) {
      properties["Phone"] = { phone_number: body.phone.trim() || null };
    }

    // Payout fields
    if (body.iban !== undefined) {
      properties["IBAN"] = { rich_text: [{ text: { content: body.iban.trim() } }] };
    }
    if (body.bic !== undefined) {
      properties["BIC"] = { rich_text: [{ text: { content: body.bic.trim() } }] };
    }
    if (body.beneficiary !== undefined) {
      properties["Beneficiary Name"] = { rich_text: [{ text: { content: body.beneficiary.trim() } }] };
    }
    if (body.payoutMethod !== undefined) {
      properties["Payout Method"] = { rich_text: [{ text: { content: body.payoutMethod.trim() } }] };
    }
    if (body.legalName !== undefined) {
      properties["Legal Name"] = { rich_text: [{ text: { content: body.legalName.trim() } }] };
    }
    if (body.billingAddress !== undefined) {
      properties["Billing Address"] = { rich_text: [{ text: { content: body.billingAddress.trim() } }] };
    }

    // Password change
    if (body.newPassword) {
      if (!body.currentPassword) {
        return NextResponse.json({ ok: false, error: "Current password is required" }, { status: 400 });
      }
      const storedHash = getProp(page, "Password");
      const currentHash = hashPassword(body.currentPassword);
      if (storedHash !== currentHash) {
        return NextResponse.json({ ok: false, error: "Current password is incorrect" }, { status: 400 });
      }
      if (body.newPassword.length < 6) {
        return NextResponse.json({ ok: false, error: "New password must be at least 6 characters" }, { status: 400 });
      }
      properties["Password"] = { rich_text: [{ text: { content: hashPassword(body.newPassword) } }] };
    }

    if (Object.keys(properties).length === 0) {
      return NextResponse.json({ ok: true, message: "No changes" });
    }

    await notion.pages.update({ page_id: page.id, properties });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Profile update error:", error?.body || error?.message || error);
    const msg = error?.body?.message || error?.message || "Failed to update profile";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
