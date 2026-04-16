import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

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
}

/**
 * Extract the authenticated user's scope from the request.
 *
 * For admins → returns `{ isAdmin: true, propertyNames: [] }` (no filter — see everything)
 * For owners → returns `{ isAdmin: false, propertyNames: [...assigned] }` (filter)
 * For unauthenticated requests → returns `null`
 */
export async function getUserScope(req: NextRequest): Promise<UserScope | null> {
  try {
    const token = await getToken({ req, secret: SECRET });
    if (!token || !token.email) return null;

    const role = (token.role as string) || "owner";
    const isAdmin = role === "admin";
    const rawProperties = (token.properties as string) || "";

    // Split comma-separated list, trim, lowercase for case-insensitive matching
    const propertyNames = rawProperties
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    return {
      isAdmin,
      email: (token.email as string).toLowerCase(),
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
