"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type ListRow = {
  id: string;
  title: string;
  created_at: string;
};

export default function ListsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [lists, setLists] = useState<ListRow[]>([]);
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

  const loadLists = async () => {
    const user = await ensureUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("lists")
      .select("id,title,created_at")
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);
    setLists((data ?? []) as ListRow[]);
  };

  useEffect(() => {
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createList = async () => {
    const title = newTitle.trim();
    if (!title) return;

    const user = await ensureUser();
    if (!user) return;

    const { error } = await supabase.from("lists").insert({
      title,
      user_id: user.id,
    });

    if (error) return alert(error.message);

    setNewTitle("");
    loadLists();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Lists</h1>
      <p style={{ marginTop: 8 }}>Logged in as: {email}</p>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <input
          style={{ flex: 1, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          placeholder="New list title..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") createList();
          }}
        />
        <button
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
          onClick={createList}
          disabled={!newTitle.trim()}
        >
          Add
        </button>
        <button
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
          onClick={signOut}
        >
          Sign out
        </button>
      </div>

      <ul style={{ marginTop: 20, paddingLeft: 18 }}>
        {lists.map((l) => (
          <li key={l.id} style={{ marginBottom: 10 }}>
            <button
              style={{
                textDecoration: "underline",
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
              }}
              onClick={() => router.push(`/lists/${l.id}`)}
            >
              {l.title}
            </button>
          </li>
        ))}
      </ul>

      {lists.length === 0 && <p style={{ marginTop: 16, opacity: 0.8 }}>No lists yet. Add one.</p>}
    </main>
  );
}
