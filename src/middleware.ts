import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

const SECRET = process.env.NEXTAUTH_SECRET || "hostyo-default-secret-change-me";

// Public paths that don't require authentication
const PUBLIC_PATHS = ["/login", "/signup", "/submit", "/pending-approval", "/api/auth", "/api/submit"];

// API routes that require authentication
const PROTECTED_API_PATHS = [
  "/api/reservations",
  "/api/properties",
  "/api/expenses",
  "/api/today",
  "/api/payouts",
  "/api/profile",
  "/api/users",
  "/api/debug",
];

// Admin-only paths
const ADMIN_PATHS = ["/users", "/tickets"];
const ADMIN_API_PATHS = ["/api/users"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static files — always allow
  if (pathname.startsWith("/_next") || pathname.includes(".") && !pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Public paths — no auth required
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: SECRET });

  // Protected API routes — require valid token
  if (PROTECTED_API_PATHS.some((p) => pathname.startsWith(p))) {
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin-only API routes
    if (ADMIN_API_PATHS.some((p) => pathname.startsWith(p))) {
      if (token.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.next();
  }

  // Other API routes — allow (catch-all for non-sensitive routes)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Protected pages — require valid token
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Pending approval — redirect to pending page
  if (token.role === "pending" && !pathname.startsWith("/pending-approval")) {
    return NextResponse.redirect(new URL("/pending-approval", req.url));
  }

  // Admin-only pages
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    if (token.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|hostyo-logo.png|property-icons|ota-logos|uploads).*)"],
};
