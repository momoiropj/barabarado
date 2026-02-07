import { NextResponse } from "next/server";

const COOKIE_NAME = "bbdo_gate";

export async function POST(req: Request) {
  const { code } = await req.json();

  const pass = process.env.CLOSED_PASSCODE;
  if (!pass) {
    return NextResponse.json(
      { error: "CLOSED_PASSCODE is not set" },
      { status: 500 }
    );
  }

  if (typeof code !== "string" || code !== pass) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });

  return res;
}
