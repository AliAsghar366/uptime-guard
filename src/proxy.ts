import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const PUBLIC_PATHS = ["/", "/auth"];

// Cheap, cookie-presence-only redirect for UX -- MySQL runs over TCP, unreachable from the Edge
// runtime this middleware executes in (unlike Supabase's HTTP API), so the actual session
// validation happens where it always needs full DB access anyway: getCurrentProfile(), called
// server-side (Node runtime) by dashboard/layout.tsx and by every admin-tier page before it
// renders anything sensitive. A forged/expired cookie gets past this check but is rejected there.
//
// /api/* is exempt from this redirect: every API route already enforces its own auth (session
// cookie for /api/files, a separate Bearer CRON_SECRET for /api/cron) since callers there --
// especially an external scheduler hitting /api/cron -- never carry a browser session cookie to
// begin with. Redirecting those to "/" would silently break them instead of 401ing correctly.
export function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  const isPublicPath =
    request.nextUrl.pathname.startsWith("/api/") ||
    PUBLIC_PATHS.some(
      (path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`)
    );

  if (!hasSessionCookie && !isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (hasSessionCookie && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};