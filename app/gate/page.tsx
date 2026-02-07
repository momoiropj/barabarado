"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function GatePage() {
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
    <main style={{ maxWidth: 480, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>クローズド版アクセス</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>パスコードを入力して入ってね。</p>

      <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="パスコード"
          style={{ width: "100%", padding: 12, fontSize: 16 }}
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
          }}
        >
          {loading ? "確認中…" : "入る"}
        </button>
      </form>

      {err && <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>}
    </main>
  );
}
