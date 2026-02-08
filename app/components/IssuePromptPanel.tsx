"use client";

import { useState } from "react";
import { buildIssuePrompt } from "@/lib/issuePrompt";

export default function IssuePromptPanel() {
  const [todo, setTodo] = useState("");
  const [context, setContext] = useState("");
  const [issued, setIssued] = useState("");
  const [copied, setCopied] = useState(false);

  const onIssue = async () => {
    const text = buildIssuePrompt({ todo, context });
    setIssued(text);
    setCopied(false);
  };

  const onCopy = async () => {
    await navigator.clipboard.writeText(issued);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>発行（コピペ用プロンプト生成）</h2>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600 }}>ToDo</div>
        <input
          value={todo}
          onChange={(e) => setTodo(e.target.value)}
          placeholder="例：クローズドリリースの準備をする"
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600 }}>Context（任意）</div>
        <input
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="例：期限は2週間、テスター10人、今はLPだけできてる"
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button
          onClick={onIssue}
          disabled={!todo.trim()}
          style={{ padding: "10px 14px" }}
        >
          発行
        </button>

        <button
          onClick={onCopy}
          disabled={!issued}
          style={{ padding: "10px 14px" }}
        >
          {copied ? "コピーした" : "コピー"}
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>生成されたプロンプト</div>
        <textarea
          value={issued}
          readOnly
          rows={18}
          style={{ width: "100%", padding: 10, whiteSpace: "pre-wrap" }}
        />
      </div>
    </section>
  );
}
