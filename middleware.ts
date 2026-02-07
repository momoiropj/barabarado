import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "bbdo_gate";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ここは常に通す（静的ファイルなど）
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  // ゲート画面と、ゲート解除APIは通す
  if (pathname.startsWith("/gate")) return NextResponse.next();
  if (pathname === "/api/gate") return NextResponse.next();

  const ok = req.cookies.get(COOKIE_NAME)?.value === "1";
  if (ok) return NextResponse.next();

  // API は redirect じゃなく 401 を返す（fetchが壊れにくい）
  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized (gate required)" }, { status: 401 });
  }

  // ページは /gate に飛ばす
  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.searchParams.set("next", pathname === "/login" ? "/lists" : pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
