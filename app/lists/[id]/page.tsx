"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ListRow = {
  id: string;
  title: string;
  created_at: string;
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

  const isGuest = mode === "guest";
  const isAuthed = mode === "authed";

  const load = async () => {
    if (!id || typeof id !== "string") return;

    // まずゲストで即表示
    setMode("guest");
    setEmail("");
    const guestLists = loadGuestLists();
    const foundGuest = guestLists.find((x) => x.id === id);
    if (foundGuest) setItem(foundGuest);

    // ログインしてたらSupabaseで上書き（失敗してもOK）
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
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          ゲストモード：この端末のブラウザ内に保存されるよ
        </p>
      )}

      {item && (
        <section style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{item.title}</h2>
          <p style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>id: {item.id}</p>
          <p style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>created: {item.created_at}</p>

          <p style={{ marginTop: 12, opacity: 0.85 }}>
            ※ここは詳細ページの最小実装。次は「分解」「チェックリスト」「メモ」などを入れていける。
          </p>
        </section>
      )}

      {!item && notFound && (
        <p style={{ marginTop: 16, color: "crimson" }}>
          このリストは見つからなかった（ゲスト保存にも、ログインDBにも無いみたい）。
        </p>
      )}

      {!item && !notFound && (
        <p style={{ marginTop: 16, opacity: 0.8 }}>読み込み中…</p>
      )}
    </main>
  );
}
