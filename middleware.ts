import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "bbdo_gate"; // 既存のままでOK（例）

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // ✅ APIは認証対象から外す（これが今回の本命）
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // ✅ Next.js内部も除外（安定化）
  if (pathname.startsWith("/_next/")) return NextResponse.next();
  if (pathname === "/favicon.ico") return NextResponse.next();

  // ↓↓↓ ここから下に、あなたの既存の認証/パスコードロジックをそのまま置く ↓↓↓
  // 例）cookieが無いなら /passcode に飛ばす…等
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
