"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type TodoRow = {
  id: string;
  title: string;
  is_done: boolean;
  created_at: string;
};

type AITodo = {
  title: string;
  tag: "first_step" | "research" | "budget" | "setup";
  estimate_min: number;
};

export default function ListDetailPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params?.id as string | undefined;

  const [email, setEmail] = useState("");
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [newTitle, setNewTitle] = useState("");

  // AI分解
  const [aiGoal, setAiGoal] = useState("");
  const [aiMode, setAiMode] = useState<AITodo["tag"]>("first_step");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState<AITodo[]>([]);

  const ensureUser = async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      router.replace("/login");
      return null;
    }
    setEmail(user.email ?? "");
    return user;
  };

  const loadTodos = async () => {
    if (!listId) return;
    const user = await ensureUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("todos")
      .select("id,title,is_done,created_at")
      .eq("list_id", listId)
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);
    setTodos((data ?? []) as TodoRow[]);
  };

  useEffect(() => {
    loadTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  const addTodo = async () => {
    if (!listId) {
      alert("List ID is missing. Please open a list from /lists.");
      return;
    }

    const title = newTitle.trim();
    if (!title) return;

    const user = await ensureUser();
    if (!user) return;

    const { error } = await supabase.from("todos").insert({
      title,
      list_id: listId,
      user_id: user.id,
    });

    if (error) return alert(error.message);

    setNewTitle("");
    loadTodos();
  };

  const toggleDone = async (id: string, next: boolean) => {
    const user = await ensureUser();
    if (!user) return;

    const { error } = await supabase.from("todos").update({ is_done: next }).eq("id", id);
    if (error) return alert(error.message);

    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, is_done: next } : t)));
  };

  const removeTodo = async (id: string) => {
    const user = await ensureUser();
    if (!user) return;

    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (error) return alert(error.message);

    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  // ===== AI分解：生成 =====
  const generateByAI = async () => {
    if (!aiGoal.trim()) return;
    if (!listId) return;

    setAiLoading(true);
    try {
      const res = await fetch("/api/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: aiGoal, mode: aiMode }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data?.error ?? "AI error");
        return;
      }

      setAiPreview((data.todos ?? []) as AITodo[]);
    } catch (e: any) {
      alert(e?.message ?? "AI error");
    } finally {
      setAiLoading(false);
    }
  };

  // ===== AI分解：一括追加 =====
  const addAIToTodos = async () => {
    if (!listId) return;
    const user = await ensureUser();
    if (!user) return;
    if (aiPreview.length === 0) return;

    const rows = aiPreview.map((t) => ({
      title: t.title,
      list_id: listId,
      user_id: user.id,
    }));

    const { error } = await supabase.from("todos").insert(rows);
    if (error) return alert(error.message);

    setAiPreview([]);
    setAiGoal("");
    loadTodos();
  };

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>Todos</h1>
        <div style={{ fontSize: 14, opacity: 0.8 }}>Logged in as: {email}</div>
      </div>

      <p style={{ marginTop: 8, opacity: 0.7 }}>listId: {listId ?? "null"}</p>

      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
          onClick={() => router.push("/lists")}
        >
          ← Back
        </button>

        <button
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
          onClick={signOut}
        >
          Sign out
        </button>
      </div>

      {/* ===== AI分解UI ===== */}
      <section style={{ marginTop: 18, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
        <div style={{ fontWeight: 700 }}>AIで分解</div>

        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <input
            style={{ flex: 1, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
            placeholder="例：引っ越ししたい / 新規事業のLPを出したい / 毎日運動したい"
            value={aiGoal}
            onChange={(e) => setAiGoal(e.target.value)}
          />
          <select
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
            value={aiMode}
            onChange={(e) => setAiMode(e.target.value as any)}
          >
            <option value="first_step">最初の一歩</option>
            <option value="research">情報収集</option>
            <option value="budget">予算</option>
            <option value="setup">段取り</option>
          </select>
          <button
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
            onClick={generateByAI}
            disabled={!aiGoal.trim() || aiLoading || !listId}
          >
            {aiLoading ? "Generating..." : "Generate"}
          </button>
        </div>

        {aiPreview.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 14, opacity: 0.8 }}>プレビュー（このまま追加される）</div>
            <ul style={{ marginTop: 8, paddingLeft: 18 }}>
              {aiPreview.map((t, i) => (
                <li key={i}>
                  {t.title} <span style={{ opacity: 0.6 }}>({t.tag}, {t.estimate_min}m)</span>
                </li>
              ))}
            </ul>

            <button
              style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
              onClick={addAIToTodos}
            >
              Add all to this list
            </button>
          </div>
        )}
      </section>

      {/* ===== 手動Todo追加 ===== */}
      <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
        <input
          style={{ flex: 1, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          placeholder="New todo..."
          value={newTitle}
          disabled={!listId}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTodo();
          }}
        />
        <button
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
          onClick={addTodo}
          disabled={!listId || !newTitle.trim()}
        >
          Add
        </button>
      </div>

      <ul style={{ marginTop: 18, paddingLeft: 0, listStyle: "none" }}>
        {todos.map((t) => (
          <li
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              border: "1px solid #eee",
              borderRadius: 10,
              marginBottom: 10,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <input
                type="checkbox"
                checked={t.is_done}
                onChange={(e) => toggleDone(t.id, e.target.checked)}
              />
              <span style={{ textDecoration: t.is_done ? "line-through" : "none" }}>{t.title}</span>
            </label>

            <button
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
              onClick={() => removeTodo(t.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {todos.length === 0 && <p style={{ marginTop: 16, opacity: 0.8 }}>No todos yet. Add one.</p>}
    </main>
  );
}
