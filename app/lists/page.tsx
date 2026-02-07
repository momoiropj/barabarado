"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ListRow = {
  id: string;
  title: string;
  created_at: string;
};

const GUEST_LISTS_KEY = "bbdo_guest_lists_v1";

function loadGuestLists(): ListRow[] {
  try {
    const raw = localStorage.getItem(GUEST_LISTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ListRow[];
  } catch {
    return [];
  }
}

function saveGuestLists(lists: ListRow[]) {
  try {
    localStorage.setItem(GUEST_LISTS_KEY, JSON.stringify(lists));
  } catch {}
}

function makeId() {
  // UUIDじゃなくてもOK：ゲスト用途＆URLキーとして十分ユニーク
  return `g_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function ListsPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"checking" | "guest" | "authed">("checking");
  const [email, setEmail] = useState<string>("");

  const [lists, setLists] = useState<ListRow[]>([]);
  const [newTitle, setNewTitle] = useState("");

  const isGuest = mode === "guest";
  const isAuthed = mode === "authed";

  const S = useMemo(
    () => ({
      btn: {
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--control-bg)",
        color: "var(--control-text)",
      } as const,
      input: {
        flex: 1,
        padding: 10,
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--control-bg)",
        color: "var(--control-text)",
        minWidth: 240,
      } as const,
      card: {
        padding: 14,
        border: "1px solid var(--border2)",
        borderRadius: 12,
        background: "var(--card)",
      } as const,
      muted: { color: "var(--muted)" } as const,
      danger: { color: "var(--danger)" } as const,
      linkBtn: {
        textDecoration: "underline",
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
        color: "var(--control-text)",
      } as const,
      note: {
        marginTop: 12,
        padding: 12,
        border: "1px solid var(--border2)",
        borderRadius: 12,
        background: "var(--card2)",
      } as const,
    }),
    []
  );

  const loadLists = async () => {
    setMode("guest");
    setEmail("");

    // まずゲスト保存を表示（即表示できる）
    const guest = loadGuestLists();
    setLists(guest);

    // ログインしてたら supabase の lists を優先表示
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) return;

      setMode("authed");
      setEmail(user.email ?? "");

      const { data: rows, error } = await supabase
        .from("lists")
        .select("id,title,created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn(error.message);
        return;
      }

      setLists((rows ?? []) as ListRow[]);
    } catch (e) {
      console.warn(e);
    }
  };

  useEffect(() => {
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createList = async () => {
    const title = newTitle.trim();
    if (!title) return;

    if (isAuthed) {
      // Supabaseに作る
      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (!user) {
        // セッション切れなど
        setMode("guest");
        setEmail("");
      } else {
        const { data, error } = await supabase
          .from("lists")
          .insert({ title, user_id: user.id })
          .select("id,title,created_at")
          .single();

        if (error) return alert(error.message);

        setNewTitle("");
        // 追加して再表示
        setLists((prev) => [{ ...(data as any) }, ...prev]);
        router.push(`/lists/${(data as any).id}`);
        return;
      }
    }

    // ゲストに作る
    const row: ListRow = {
      id: makeId(),
      title,
      created_at: new Date().toISOString(),
    };

    const next = [row, ...lists];
    setLists(next);
    saveGuestLists(next);
    setNewTitle("");
    router.push(`/lists/${row.id}`);
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    setMode("guest");
    setEmail("");
    loadLists();
    router.refresh?.();
  };

  const goHelp = () => router.push("/help");
  const goConcept = () => router.push("/concept");

  return (
    <main style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Lists</h1>

      <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        {isAuthed ? (
          <p style={{ margin: 0, ...S.muted }}>Logged in as: {email}</p>
        ) : (
          <p style={{ margin: 0, ...S.muted }}>ゲストモード：この端末のブラウザ内に保存されるよ</p>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={S.btn} onClick={goConcept}>コンセプト</button>
          <button style={S.btn} onClick={goHelp}>使い方</button>
        </div>
      </div>

      {/* ゲスト注意文（Listsにも表示） */}
      <section style={S.note}>
        <div style={{ fontWeight: 800 }}>テスト利用の注意（ゲストモード）</div>
        <ul style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.8, fontSize: 13, ...S.muted }}>
          <li>内容はこの端末のブラウザ内に保存される（別端末では見えない）</li>
          <li>ブラウザのデータ削除で消えることがあるので、大事なものはコピーで保存</li>
          <li>個人情報・社外秘は入れない（固有名詞は「A社」「Bさん」等でOK）</li>
        </ul>
      </section>

      {/* 作成UI */}
      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          style={S.input}
          placeholder="New list title..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") createList();
          }}
        />
        <button style={S.btn} onClick={createList} disabled={!newTitle.trim()}>
          Add
        </button>
        <button style={S.btn} onClick={signOut} disabled={!isAuthed}>
          Sign out
        </button>
      </div>

      {/* Lists */}
      <section style={{ marginTop: 16, ...S.card }}>
        {lists.length === 0 ? (
          <p style={{ margin: 0, ...S.muted }}>No lists yet. Add one.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {lists.map((l) => (
              <li key={l.id} style={{ marginBottom: 10 }}>
                <button style={S.linkBtn} onClick={() => router.push(`/lists/${l.id}`)}>
                  {l.title}
                </button>
                <span style={{ marginLeft: 10, fontSize: 12, ...S.muted }}>
                  {l.created_at ? new Date(l.created_at).toLocaleString() : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
