/**
 * Optimistic gate only: bounce requests without a session cookie away from portals before
 * rendering. Real authorization (role checks) happens in src/server/auth/guard.ts.
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/student/:path*", "/recruiter/:path*", "/college/:path*", "/mentor/:path*"],
};
