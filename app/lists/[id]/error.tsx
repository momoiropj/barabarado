// app/lists/[id]/error.tsx
"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // ここに来た時点で「原因がある」ので、最低限ログ出す
    console.error("lists/[id] crashed:", error);
  }, [error]);

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 800 }}>エラーが起きた（でも大丈夫）</h1>
      <p style={{ opacity: 0.8, marginTop: 8 }}>
        いまは原因を特定するために、落ちた理由を表示してるよ。
      </p>

      <pre
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          background: "rgba(0,0,0,0.06)",
          overflowX: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {error?.message ?? String(error)}
        {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={() => reset()}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.18)",
            fontWeight: 800,
            cursor: "pointer",
          }}
          type="button"
        >
          再試行
        </button>

        <a
          href="/lists"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.18)",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Listsへ戻る
        </a>
      </div>
    </main>
  );
}
