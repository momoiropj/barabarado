"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ListRow = {
  id: string;
  title: string;
  created_at: string;
};

type BreakdownResult = {
  title: string;
  think_first: string[];
  draft_plans: Array<{
    title: string;
    todos: Array<{ title: string; estimate_min: number; tag: string }>;
  }>;
  copypaste_prompt: string;
};

const GUEST_STORAGE_KEY = "bbdo_guest_lists_v1";

function loadGuestLists(): ListRow[] {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ListRow[];
  } catch {
    return [];
  }
}

export default function ListDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [mode, setMode] = useState<"checking" | "guest" | "authed">("checking");
  const [email, setEmail] = useState("");
  const [item, setItem] = useState<ListRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  // AI
  const [ai, setAi] = useState<BreakdownResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const isGuest = mode === "guest";
  const isAuthed = mode === "authed";

  const load = async () => {
    if (!id || typeof id !== "string") return;

    // まずゲストで即表示（スピード優先）
    setMode("guest");
    setEmail("");
    const guestLists = loadGuestLists();
    const foundGuest = guestLists.find((x) => x.id === id);
    if (foundGuest) setItem(foundGuest);

    // その後、ログインしてたらSupabaseで上書き
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        if (!foundGuest) setNotFound(true);
        return;
      }

      setMode("authed");
      setEmail(user.email ?? "");

      const { data: row, error } = await supabase
        .from("lists")
        .select("id,title,created_at")
        .eq("id", id)
        .single();

      if (error) {
        setNotFound(true);
        return;
      }

      setItem(row as ListRow);
      setNotFound(false);
    } catch {
      if (!foundGuest) setNotFound(true);
      return;
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const headerText = useMemo(() => {
    if (mode === "checking") return "Loading…";
    if (isGuest) return "List (Guest Mode)";
    return "List";
  }, [mode, isGuest]);

  const runBreakdown = async () => {
    if (!item) return;

    setAiError("");
    setAiLoading(true);
    setAi(null);

    try {
      const res = await fetch("/api/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: item.title }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "API error");

      setAi(data as BreakdownResult);
    } catch (e: any) {
      setAiError(e?.message ?? "Failed");
    } finally {
      setAiLoading(false);
    }
  };

  const copyAll = async () => {
    if (!item || !ai) return;

    const text =
      `【ToDo】${item.title}\n\n` +
      `【最初に考える】\n- ${(ai.think_first ?? []).join("\n- ")}\n\n` +
      `【仮案】\n` +
      (ai.draft_plans ?? [])
        .map(
          (p) =>
            `■ ${p.title}\n- ${(p.todos ?? []).map((t) => `${t.title} (${t.estimate_min}m)`).join("\n- ")}`
        )
        .join("\n\n") +
      `\n\n【コピペ用プロンプト】\n${ai.copypaste_prompt ?? ""}\n`;

    await navigator.clipboard.writeText(text);
    alert("コピーした！");
  };

  const copyPrompt = async () => {
    if (!ai?.copypaste_prompt) return;
    await navigator.clipboard.writeText(ai.copypaste_prompt);
    alert("プロンプトをコピーした！");
  };

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <button
        style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 12px" }}
        onClick={() => router.push("/lists")}
      >
        ← Back
      </button>

      <h1 style={{ marginTop: 16, fontSize: 28, fontWeight: 700 }}>{headerText}</h1>

      {isAuthed ? (
        <p style={{ marginTop: 8 }}>Logged in as: {email}</p>
      ) : (
        <p style={{ marginTop: 8, opacity: 0.8 }}>ゲストモード：この端末のブラウザ内に保存されるよ</p>
      )}

      {item && (
        <section style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{item.title}</h2>
          <p style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>id: {item.id}</p>
          <p style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>created: {item.created_at}</p>

          {/* 操作ボタン */}
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
              onClick={runBreakdown}
              disabled={aiLoading}
            >
              {aiLoading ? "分解中…" : "AIで分解"}
            </button>

            <button
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
              onClick={copyAll}
              disabled={!ai}
            >
              全部コピー
            </button>
          </div>

          {aiError && <p style={{ marginTop: 12, color: "crimson" }}>{aiError}</p>}

          {/* AI結果 */}
          {ai && (
            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>最初に考える</h3>
                <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                  {(ai.think_first ?? []).map((x, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>
                      {x}
                    </li>
                  ))}
                </ul>
              </section>

              <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>仮案</h3>

                {(ai.draft_plans ?? []).map((p, i) => (
                  <div key={i} style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 700 }}>{p.title}</div>
                    <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                      {(p.todos ?? []).map((t, j) => (
                        <li key={j} style={{ marginBottom: 6 }}>
                          {t.title}{" "}
                          <span style={{ opacity: 0.6, fontSize: 12 }}>({t.estimate_min}m)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>

              <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>コピペ用プロンプト</h3>
                <textarea
                  readOnly
                  value={ai.copypaste_prompt ?? ""}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    height: 180,
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #ddd",
                  }}
                />
                <button
                  style={{ marginTop: 8, padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
                  onClick={copyPrompt}
                >
                  プロンプトだけコピー
                </button>
              </section>
            </div>
          )}

          <p style={{ marginTop: 12, opacity: 0.85 }}>
            ※ここは詳細ページの最小実装。次は「分解→チェックリスト化→保存」へいける。
          </p>
        </section>
      )}

      {!item && notFound && (
        <p style={{ marginTop: 16, color: "crimson" }}>
          このリストは見つからなかった（ゲスト保存にも、ログインDBにも無いみたい）。
        </p>
      )}

      {!item && !notFound && <p style={{ marginTop: 16, opacity: 0.8 }}>読み込み中…</p>}
    </main>
  );
}
