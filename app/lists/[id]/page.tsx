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

export default function ListDetailPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params?.id as string | undefined;

  const [email, setEmail] = useState("");
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [newTitle, setNewTitle] = useState("");

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
    if (!listId) return; // listIdが取れない間は何もしない
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

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>Todos</h1>
        <div style={{ fontSize: 14, opacity: 0.8 }}>Logged in as: {email}</div>
      </div>

      {/* デバッグ用：listIdが取れてるか確認（慣れたら消してOK） */}
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

      {!listId && (
        <p style={{ marginTop: 16, color: "crimson" }}>
          You are on /lists, not /lists/&lt;id&gt;. Go back and open a list first.
        </p>
      )}
    </main>
  );
}
