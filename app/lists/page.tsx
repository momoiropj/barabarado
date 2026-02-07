"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type ListRow = {
  id: string;
  title: string;
  created_at: string;
};

const GUEST_STORAGE_KEY = "bbdo_guest_lists_v1";

function nowIso() {
  return new Date().toISOString();
}

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

function saveGuestLists(lists: ListRow[]) {
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(lists));
}

export default function ListsPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"checking" | "guest" | "authed">("checking");
  const [email, setEmail] = useState<string>("");
  const [lists, setLists] = useState<ListRow[]>([]);
  const [newTitle, setNewTitle] = useState("");

  const isGuest = mode === "guest";
  const isAuthed = mode === "authed";

  // ログイン状態を確認（ログインしてなくてもOKにする）
  const detectMode = async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      setMode("guest");
      setEmail("");
      // ゲストはローカルから読む
      setLists(loadGuestLists());
      return null;
    }

    setMode("authed");
    setEmail(user.email ?? "");
    return user;
  };

 const loadLists = async () => {
  // まずゲストとして即表示（ここがポイント）
  setMode("guest");
  setEmail("");
  setLists(loadGuestLists());

  // その後に「ログインしてたら」上書きする（失敗してもOK）
  try {
    const { data } = await supabase.auth.getSession(); // getUserより軽い
    const user = data.session?.user;
    if (!user) return;

    setMode("authed");
    setEmail(user.email ?? "");

    const { data: rows, error } = await supabase
      .from("lists")
      .select("id,title,created_at")
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);
    setLists((rows ?? []) as ListRow[]);
  } catch {
    // 何かあってもゲスト表示はできてるので黙ってOK
    return;
  }
};


  useEffect(() => {
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createList = async () => {
    const title = newTitle.trim();
    if (!title) return;

    // ゲスト：localStorageに追加
    if (isGuest) {
      const next: ListRow[] = [
        { id: crypto.randomUUID(), title, created_at: nowIso() },
        ...lists,
      ];
      setLists(next);
      saveGuestLists(next);
      setNewTitle("");
      return;
    }

    // ログイン：Supabaseに追加
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      // 念のため：途中でログアウトしてたらゲストに落とす
      setMode("guest");
      setEmail("");
      const g = loadGuestLists();
      setLists(g);
      return;
    }

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
    setMode("guest");
    setEmail("");
    const g = loadGuestLists();
    setLists(g);
  };

  const headerText = useMemo(() => {
    if (mode === "checking") return "Loading…";
    if (isGuest) return "Lists (Guest Mode)";
    return "Lists";
  }, [mode, isGuest]);

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>{headerText}</h1>

      {mode === "checking" ? (
        <p style={{ marginTop: 8, opacity: 0.8 }}>Checking session…</p>
      ) : (
        <>
          {isAuthed ? (
            <p style={{ marginTop: 8 }}>Logged in as: {email}</p>
          ) : (
            <p style={{ marginTop: 8, opacity: 0.8 }}>
              ゲストモード：この端末のブラウザ内に保存されるよ（別端末には引き継がれない）
            </p>
          )}

          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              style={{ flex: 1, minWidth: 240, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
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

            {isAuthed ? (
              <button
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
                onClick={signOut}
              >
                Sign out
              </button>
            ) : (
              <button
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
                onClick={() => router.push("/login")}
              >
                ログイン（任意）
              </button>
            )}
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

          {lists.length === 0 && (
            <p style={{ marginTop: 16, opacity: 0.8 }}>No lists yet. Add one.</p>
          )}
        </>
      )}
    </main>
  );
}
