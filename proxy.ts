import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: no session cookie → /login. Pages and API routes still verify
// the signed cookie themselves (lib/server/session.ts).
export function proxy(request: NextRequest) {
  if (request.cookies.has("nado_session")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/matches", "/groups", "/profile", "/rooms/:path*"],
};
