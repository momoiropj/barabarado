import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "bbdo_gate";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/gate") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  const ok = req.cookies.get(COOKIE_NAME)?.value === "1";
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
