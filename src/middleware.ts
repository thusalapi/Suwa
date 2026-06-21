import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Gates the app. Runs in the edge runtime, so it only verifies the session signature
 * (Web Crypto) — it never touches the DB or argon2. Full user/role checks happen
 * server-side in each route/mutation (defense in depth).
 */
const PUBLIC_PATHS = ["/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!session && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (session && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals, and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brand|.*\\..*).*)"],
};
