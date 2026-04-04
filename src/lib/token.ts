/**
 * Encode a Notion page ID into a URL-safe token and back.
 * Uses base64url so the token is safe in URLs without escaping.
 */

export function encodeToken(notionPageId: string): string {
  // Remove hyphens from UUID format
  const clean = notionPageId.replace(/-/g, "");
  return Buffer.from(clean, "hex").toString("base64url");
}

export function decodeToken(token: string): string {
  const hex = Buffer.from(token, "base64url").toString("hex");
  // Re-insert hyphens into UUID format: 8-4-4-4-12
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Encode a property name into a URL-safe token (prefixed with "prop_") */
export function encodePropertyToken(propertyName: string): string {
  return "prop_" + Buffer.from(propertyName, "utf-8").toString("base64url");
}

/** Decode a property token back to a property name */
export function decodePropertyToken(token: string): string {
  return Buffer.from(token.slice(5), "base64url").toString("utf-8");
}

/** Check if a token is a property token */
export function isPropertyToken(token: string): boolean {
  return token.startsWith("prop_");
}
