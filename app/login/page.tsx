// app/login/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const [msg, setMsg] = useState<string>("");

  // ✅ Supabase が未設定でもビルドが落ちないようにする（ここが今回の肝）
  const hasSupabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return Boolean(url && key);
  }, []);

  useEffect(() => {
    // Supabase 未設定ならログイン機能は無効としてトップへ誘導（＝ビルドは落とさない）
    if (!hasSupabase) {
      setMsg("ログイン機能は未設定（Supabase環境変数が未設定）なので、いったんトップへ戻るよ。");
      const t = setTimeout(() => router.replace("/"), 900);
      return () => clearTimeout(t);
    }
  }, [hasSupabase, router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          borderRadius: 18,
          border: "1px solid rgba(0,0,0,0.08)",
          background: "rgba(255,255,255,0.85)",
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 20 }}>Login</div>

        {!hasSupabase ? (
          <p style={{ marginTop: 10, lineHeight: 1.7, fontWeight: 800, opacity: 0.85 }}>
            {msg || "Supabase環境変数が未設定のため、ログイン画面は無効化中。"}
          </p>
        ) : (
          <p style={{ marginTop: 10, lineHeight: 1.7, fontWeight: 800, opacity: 0.85 }}>
            Supabaseが設定されているので、ここにログインUIを実装できるよ（現状は未実装）。
          </p>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button
            onClick={() => router.push("/")}
            style={{
              borderRadius: 14,
              padding: "12px 14px",
              fontWeight: 900,
              cursor: "pointer",
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,180,120,0.35)",
            }}
          >
            トップへ戻る
          </button>

          <button
            onClick={() => router.push("/lists")}
            style={{
              borderRadius: 14,
              padding: "12px 14px",
              fontWeight: 900,
              cursor: "pointer",
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.7)",
            }}
          >
            Listsへ
          </button>
        </div>

        <p style={{ marginTop: 14, fontSize: 12, fontWeight: 800, opacity: 0.7, lineHeight: 1.6 }}>
          ※このページは「存在するだけでビルドが落ちる」を防ぐため、Supabase未設定時は安全にトップへ戻すようにしてある。
        </p>
      </div>
    </main>
  );
}
