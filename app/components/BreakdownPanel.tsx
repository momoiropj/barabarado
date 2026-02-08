"use client";

import { useState } from "react";

async function breakdownTodo(todo: string, context: string) {
  const res = await fetch("/api/ai/breakdown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ todo, context }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error ?? "AI分解に失敗した");
  }

  return data.text as string;
}

export default function BreakdownPanel() {
  const [todo, setTodo] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onRun() {
    setLoading(true);
    setError("");
    try {
      const text = await breakdownTodo(todo, context);
      setResult(text);
    } catch (e: any) {
      setError(e?.message ?? "エラー");
    } finally {
      setLoading(false);
    }
  }

  async function onCopy() {
    await navigator.clipboard.writeText(result);
  }

  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>AIで分解</h2>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600 }}>ToDo</div>
        <input
          value={todo}
          onChange={(e) => setTodo(e.target.value)}
          placeholder="例：確定申告の準備をする"
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600 }}>Context（任意）</div>
        <input
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="例：期限:来週。レシートが散らばってる"
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button
          onClick={onRun}
          disabled={loading || !todo.trim()}
          style={{ padding: "10px 14px" }}
        >
          {loading ? "分解中..." : "分解する"}
        </button>

        <button
          onClick={onCopy}
          disabled={!result}
          style={{ padding: "10px 14px" }}
        >
          コピー
        </button>
      </div>

      {error && <p style={{ marginTop: 10, color: "crimson" }}>{error}</p>}

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>結果</div>
        <textarea
          value={result}
          readOnly
          rows={16}
          style={{ width: "100%", padding: 10, whiteSpace: "pre-wrap" }}
        />
      </div>
    </section>
  );
}
