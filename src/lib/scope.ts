/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { Client } from "@notionhq/client";
import { IMPERSONATE_COOKIE, verifyImpersonation } from "./impersonation";

const SECRET = process.env.NEXTAUTH_SECRET || "hostyo-default-secret-change-me";

export interface UserScope {
  isAdmin: boolean;
  email: string;
  /**
   * Lowercased, trimmed property names the user is allowed to see.
   * Empty array for admins means "all properties".
   * Empty array for owners means "no properties" — they see nothing.
   */
  propertyNames: string[];
  /** If the current admin is impersonating someone, this is set to the admin's real email. */
  realEmail?: string;
  isImpersonating?: boolean;
}

async function loadUserFromNotion(email: string): Promise<{ isAdmin: boolean; propertyNames: string[] } | null> {
  const USERS_DB = process.env.NOTION_USERS_DB || "";
  if (!USERS_DB || !email) return null;
  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const res: any = await notion.databases.query({
      database_id: USERS_DB,
      filter: { property: "Email", email: { equals: email.toLowerCase().trim() } },
      page_size: 1,
    });
    const page = res.results?.[0];
    if (!page) return null;
    const propsRaw = page.properties?.["Properties"]?.rich_text?.[0]?.plain_text || "";
    const isAdmin = page.properties?.["Is Admin"]?.checkbox === true;
    const propertyNames = propsRaw
      .split(",")
      .map((s: string) => s.trim().toLowerCase())
      .filter(Boolean);
    return { isAdmin, propertyNames };
  } catch { return null; }
}

/**
 * Extract the authenticated user's scope from the request.
 *
 * For admins → returns `{ isAdmin: true, propertyNames: [] }` (no filter — see everything)
 * For owners → returns `{ isAdmin: false, propertyNames: [...assigned] }` (filter)
 * For unauthenticated requests → returns `null`
 *
 * **Impersonation**: if the real user is admin and has a valid `hostyo-impersonate`
 * cookie, the returned scope belongs to the impersonated user instead. The admin's
 * real email is preserved in `realEmail` for audit logging.
 */
export async function getUserScope(req: NextRequest): Promise<UserScope | null> {
  try {
    const token = await getToken({ req, secret: SECRET });
    if (!token || !token.email) return null;

    const role = (token.role as string) || "owner";
    const isAdmin = role === "admin";
    const rawProperties = (token.properties as string) || "";
    const realEmail = (token.email as string).toLowerCase();

    const propertyNames = rawProperties
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // Check for impersonation (admin only)
    if (isAdmin) {
      const cookieValue = req.cookies.get(IMPERSONATE_COOKIE)?.value;
      const targetEmail = verifyImpersonation(cookieValue);
      if (targetEmail && targetEmail !== realEmail) {
        const impersonated = await loadUserFromNotion(targetEmail);
        if (impersonated && !impersonated.isAdmin) {
          // Adopt the impersonated user's scope, but remember we're pretending.
          return {
            isAdmin: false,
            email: targetEmail,
            propertyNames: impersonated.propertyNames,
            realEmail,
            isImpersonating: true,
          };
        }
      }
    }

    return {
      isAdmin,
      email: realEmail,
      propertyNames,
    };
  } catch {
    return null;
  }
}

/**
 * Returns `true` if the given property name is within the user's scope.
 *
 * Admins see everything. Owners only see properties in their assigned list.
 * Fuzzy matching (startsWith either direction) so minor name variations still match.
 */
export function isInScope(scope: UserScope, propertyName: string): boolean {
  if (scope.isAdmin) return true;
  const n = (propertyName || "").trim().toLowerCase();
  if (!n) return false;
  return scope.propertyNames.some((allowed) => {
    if (!allowed) return false;
    return allowed === n || allowed.startsWith(n) || n.startsWith(allowed);
  });
}

/**
 * Filters an array of items to only those the user has access to.
 * The `getProperty` callback returns the property name for each item.
 */
export function filterByScope<T>(
  scope: UserScope,
  items: T[],
  getProperty: (item: T) => string
): T[] {
  if (scope.isAdmin) return items;
  return items.filter((item) => isInScope(scope, getProperty(item)));
}
