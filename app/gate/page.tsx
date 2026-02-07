"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

// /gate はビルド時に静的生成させない（ここ重要）
export const dynamic = "force-dynamic";

function GateInner() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const res = await fetch("/api/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    setLoading(false);

    if (!res.ok) {
      setErr("パスコードが違うみたい。もう一回！");
      return;
    }

    window.location.href = next;
  }

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>クローズド版アクセス</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>パスコードを入力して入ってね。</p>

      <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="パスコード"
          style={{ width: "100%", padding: 12, fontSize: 16, border: "1px solid #ddd", borderRadius: 10 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 12,
            padding: 12,
            fontSize: 16,
            cursor: "pointer",
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "white",
          }}
        >
          {loading ? "確認中…" : "入る"}
        </button>
      </form>

      {err && <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>}

      {/* ▼ ゲストユーザー向けの注意文 ▼ */}
      <section
        style={{
          marginTop: 18,
          padding: 12,
          border: "1px solid #eee",
          borderRadius: 12,
          background: "#fafafa",
        }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>テスト利用の注意（ゲストモード）</h2>
        <ul style={{ marginTop: 10, paddingLeft: 18, lineHeight: 1.8, fontSize: 13, opacity: 0.9 }}>
          <li>
            入力した内容は、この端末のブラウザ内に保存されるよ（ログインなし）。<b>別の端末・別ブラウザでは見えない</b>。
          </li>
          <li>
            ブラウザのデータ削除などで内容が消えることがあるので、大事なものは<b>「コピー」</b>でメモ帳やNotionに保存してね。
          </li>
          <li>共有PCでの利用はおすすめしない（他の人に見られる可能性あり）。</li>
          <li>
            AI分解／プロンプト発行を使うと入力内容がAIに送信されるよ。<b>住所・電話・口座・健康情報・社外秘は入れないで</b>。
            固有名詞は「A社」「Bさん」みたいに伏せ字でOK。
          </li>
          <li>このパスコードはテストユーザー限定。第三者への共有はしないでね。</li>
        </ul>
      </section>
      {/* ▲ ここまで ▲ */}
    </main>
  );
}

export default function GatePage() {
  // useSearchParams() を使う部分を Suspense で包む（ここ重要）
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>読み込み中…</div>}>
      <GateInner />
    </Suspense>
  );
}
