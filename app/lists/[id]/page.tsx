"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ListRow = {
  id: string;
  title: string;
  created_at: string;
};

type BucketKey = "motivation" | "plan" | "budget" | "procedure" | "setup";

type ChecklistItem = {
  id: string;
  title: string;
  estimate_min: number;
  done: boolean;
};

type Bucket = {
  key: BucketKey;
  label: string;
  items: ChecklistItem[];
};

const GUEST_LISTS_KEY = "bbdo_guest_lists_v1";
const checklistKey = (listId: string) => `bbdo_guest_checklist_v1_${listId}`;
const draftKey = (listId: string) => `bbdo_guest_draft_v1_${listId}`;

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

function updateGuestListTitle(listId: string, newTitle: string) {
  const lists = loadGuestLists();
  const next = lists.map((l) => (l.id === listId ? { ...l, title: newTitle } : l));
  try {
    localStorage.setItem(GUEST_LISTS_KEY, JSON.stringify(next));
  } catch {}
}

function saveChecklist(listId: string, buckets: Bucket[] | null, prompt: string) {
  try {
    localStorage.setItem(
      checklistKey(listId),
      JSON.stringify({
        version: 3,
        savedAt: new Date().toISOString(),
        buckets: buckets ?? null,
        prompt: prompt ?? "",
      })
    );
  } catch {}
}

function loadChecklist(listId: string): { buckets: Bucket[] | null; prompt: string } | null {
  try {
    const raw = localStorage.getItem(checklistKey(listId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      buckets: (parsed?.buckets ?? null) as Bucket[] | null,
      prompt: String(parsed?.prompt ?? ""),
    };
  } catch {
    return null;
  }
}

function saveDraft(listId: string, text: string) {
  try {
    localStorage.setItem(draftKey(listId), text ?? "");
  } catch {}
}

function loadDraft(listId: string): string {
  try {
    return localStorage.getItem(draftKey(listId)) ?? "";
  } catch {
    return "";
  }
}

function baseBuckets(): Bucket[] {
  return [
    { key: "motivation", label: "目的・動機", items: [] },
    { key: "plan", label: "段取り（期限/見積）", items: [] },
    { key: "budget", label: "予算（仮でOK）", items: [] },
    { key: "procedure", label: "手続き（連絡/申請/予約）", items: [] },
    { key: "setup", label: "準備（道具/環境/リスク）", items: [] },
  ];
}

function makeId() {
  return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function ListDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [mode, setMode] = useState<"checking" | "guest" | "authed">("checking");
  const [email, setEmail] = useState("");
  const [item, setItem] = useState<ListRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  // title edit
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleError, setTitleError] = useState("");

  // free draft
  const [freeText, setFreeText] = useState("");
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState("");

  // checklist
  const [buckets, setBuckets] = useState<Bucket[] | null>(null);

  // manual add
  const [addText, setAddText] = useState<Record<string, string>>({});

  // prompt (最後だけ)
  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState("");

  const isGuest = mode === "guest";
  const isAuthed = mode === "authed";

  const headerText = useMemo(() => {
    if (mode === "checking") return "Loading…";
    if (isGuest) return "List (Guest Mode)";
    return "List";
  }, [mode, isGuest]);

  const load = async () => {
    if (!id || typeof id !== "string") return;

    setMode("guest");
    setEmail("");

    const guestLists = loadGuestLists();
    const foundGuest = guestLists.find((x) => x.id === id);

    if (foundGuest) {
      setItem(foundGuest);
      setTitleDraft(foundGuest.title);
      setNotFound(false);
    }

    // restore draft
    setFreeText(loadDraft(id));

    // restore checklist/prompt
    const saved = loadChecklist(id);
    if (saved) {
      setBuckets(saved.buckets);
      setPrompt(saved.prompt);
    } else {
      setBuckets(null);
      setPrompt("");
    }

    // if logged in, overwrite item from supabase (optional)
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

      if (error || !row) {
        if (!foundGuest) setNotFound(true);
        return;
      }

      setItem(row as ListRow);
      setTitleDraft((row as any).title ?? "");
      setNotFound(false);
    } catch {
      if (!foundGuest) setNotFound(true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const saveTitle = async () => {
    if (!item || !id) return;

    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setTitleError("タイトルが空はダメ");
      return;
    }

    updateGuestListTitle(id, nextTitle);
    setItem({ ...item, title: nextTitle });
    setIsEditingTitle(false);
    setTitleError("");

    if (isAuthed) {
      try {
        const { error } = await supabase.from("lists").update({ title: nextTitle }).eq("id", id);
        if (error) setTitleError(`DB更新に失敗（見た目は更新済み）：${error.message}`);
      } catch (e: any) {
        setTitleError(`DB更新に失敗（見た目は更新済み）：${e?.message ?? "unknown"}`);
      }
    }
  };

  const ensureBuckets = () => {
    if (!id) return;
    if (!buckets) {
      const base = baseBuckets();
      setBuckets(base);
      saveChecklist(id, base, prompt);
    }
  };

  const createEmptyChecklist = () => {
    if (!id) return;
    const base = buckets ?? baseBuckets();
    setBuckets(base);
    saveChecklist(id, base, prompt);
  };

  const categorizeMerge = async () => {
    if (!item || !id) return;

    setCatError("");
    setCatLoading(true);

    try {
      const current = buckets ?? baseBuckets();

      const res = await fetch("/api/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: item.title,
          draftText: freeText,
          existingBuckets: current,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "API error");

      const merged: Bucket[] = data?.buckets ?? null;
      if (!merged || !Array.isArray(merged)) throw new Error("Invalid response");

      setBuckets(merged);
      saveChecklist(id, merged, prompt);
    } catch (e: any) {
      setCatError(e?.message ?? "Failed");
    } finally {
      setCatLoading(false);
    }
  };

  const toggleDone = (bucketKey: BucketKey, itemId: string) => {
    if (!buckets || !id) return;

    const next = buckets.map((b) =>
      b.key !== bucketKey
        ? b
        : { ...b, items: b.items.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it)) }
    );

    setBuckets(next);
    saveChecklist(id, next, prompt);
  };

  const deleteItem = (bucketKey: BucketKey, itemId: string) => {
    if (!buckets || !id) return;

    const next = buckets.map((b) =>
      b.key !== bucketKey ? b : { ...b, items: b.items.filter((it) => it.id !== itemId) }
    );

    setBuckets(next);
    saveChecklist(id, next, prompt);
  };

  const addItem = (bucketKey: BucketKey) => {
    if (!id) return;
    ensureBuckets();

    const current = buckets ?? baseBuckets();
    const text = (addText[bucketKey] ?? "").trim();
    if (!text) return;

    const newItem: ChecklistItem = {
      id: makeId(),
      title: text,
      estimate_min: 5,
      done: false,
    };

    const next = current.map((b) => (b.key !== bucketKey ? b : { ...b, items: [...b.items, newItem] }));
    setBuckets(next);
    setAddText((prev) => ({ ...prev, [bucketKey]: "" }));
    saveChecklist(id, next, prompt);
  };

  const generatePrompt = async (): Promise<string | null> => {
    if (!item || !id) return null;
    if (!buckets || buckets.length === 0) return null;

    setPromptError("");
    setPromptLoading(true);

    try {
      const res = await fetch("/api/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: item.title, buckets }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "API error");

      const p = String(data?.prompt ?? "");
      setPrompt(p);
      saveChecklist(id, buckets, p);
      return p;
    } catch (e: any) {
      setPromptError(e?.message ?? "Failed");
      return null;
    } finally {
      setPromptLoading(false);
    }
  };

  const formatChecklistText = () => {
    if (!item) return "";
    const header = `【ToDo】${item.title}\n\n`;
    const body =
      buckets && buckets.length
        ? buckets
            .map((b) => {
              const lines = (b.items ?? []).map((it) => {
                const mark = it.done ? "☑" : "☐";
                return `${mark} ${it.title} (${it.estimate_min}m)`;
              });
              return `【${b.label}】\n${lines.join("\n")}`;
            })
            .join("\n\n") + "\n"
        : "(チェックリストがまだない)\n";
    return header + body;
  };

  const copyChecklistOnly = async () => {
    const text = formatChecklistText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    alert("チェックリストをコピーした！");
  };

  const copyPromptOnly = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    alert("プロンプトをコピーした！");
  };

  const copyChecklistAndPrompt = async () => {
    if (!item) return;
    if (!buckets || buckets.length === 0) return;

    let p = prompt;

    if (!p) {
      const ok = confirm("プロンプトが未発行。いま発行して一緒にコピーする？");
      if (!ok) {
        await copyChecklistOnly();
        return;
      }
      const generated = await generatePrompt();
      p = generated ?? "";
    }

    const checklistText = formatChecklistText();
    const promptBlock = p ? `\n【自走用プロンプト】\n${p}\n` : `\n【自走用プロンプト】\n(発行に失敗)\n`;

    await navigator.clipboard.writeText(checklistText + promptBlock);
    alert("チェックリスト＋プロンプトをコピーした！");
  };

  return (
    <main style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
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
          {/* Title + edit */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {!isEditingTitle ? (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{item.title}</h2>
                <button
                  style={{ border: "1px solid #ddd", borderRadius: 10, padding: "6px 10px" }}
                  onClick={() => {
                    setTitleError("");
                    setTitleDraft(item.title);
                    setIsEditingTitle(true);
                  }}
                >
                  編集
                </button>
              </>
            ) : (
              <>
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  style={{ flex: 1, minWidth: 220, padding: 10, border: "1px solid #ddd", borderRadius: 10 }}
                />
                <button style={{ border: "1px solid #ddd", borderRadius: 10, padding: "6px 10px" }} onClick={saveTitle}>
                  保存
                </button>
                <button
                  style={{ border: "1px solid #ddd", borderRadius: 10, padding: "6px 10px" }}
                  onClick={() => {
                    setTitleError("");
                    setTitleDraft(item.title);
                    setIsEditingTitle(false);
                  }}
                >
                  キャンセル
                </button>
              </>
            )}
          </div>

          {titleError && <p style={{ marginTop: 8, color: "crimson" }}>{titleError}</p>}

          <p style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>id: {item.id}</p>

          {/* Step 1: Free draft */}
          <section style={{ marginTop: 14, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>まず自由に書く（下書き）</h3>
            <p style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
              思いついた順でOK。箇条書き推奨。AIで分類しても消えない。
            </p>

            <textarea
              value={freeText}
              onChange={(e) => {
                const v = e.target.value;
                setFreeText(v);
                if (id) saveDraft(id, v);
              }}
              placeholder={"例）\n・片付けたい理由を言語化\n・捨てる基準を決める\n・ゴミ袋を買う\n"}
              style={{
                marginTop: 8,
                width: "100%",
                height: 140,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
                onClick={categorizeMerge}
                disabled={catLoading}
              >
                {catLoading ? "分類中…" : "AIで5カテゴリに分ける（取り込み）"}
              </button>

              <button
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
                onClick={createEmptyChecklist}
              >
                先に空のチェックリストを作る
              </button>
            </div>

            {catError && <p style={{ marginTop: 10, color: "crimson" }}>{catError}</p>}
          </section>

          {/* Step 2: Checklist */}
          {buckets && buckets.length > 0 && (
            <section style={{ marginTop: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>チェックリスト（編集OK）</h3>
              <p style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
                AI分類後も、手動で追加/削除/チェックできる。AI分類を押しても消えない（取り込み）。
              </p>

              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {buckets.map((b) => (
                  <section key={b.key} style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{b.label}</h4>

                      <button
                        style={{ border: "1px solid #ddd", borderRadius: 10, padding: "6px 10px" }}
                        onClick={() => setAddText((prev) => ({ ...prev, [b.key]: prev[b.key] ?? "" }))}
                      >
                        ＋追加
                      </button>
                    </div>

                    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                      <input
                        value={addText[b.key] ?? ""}
                        onChange={(e) => setAddText((prev) => ({ ...prev, [b.key]: e.target.value }))}
                        placeholder="自分で追加…（Enterで追加）"
                        style={{ flex: 1, padding: 10, border: "1px solid #ddd", borderRadius: 10 }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addItem(b.key);
                        }}
                      />
                      <button
                        style={{ border: "1px solid #ddd", borderRadius: 10, padding: "6px 10px" }}
                        onClick={() => addItem(b.key)}
                        disabled={!(addText[b.key] ?? "").trim()}
                      >
                        追加
                      </button>
                    </div>

                    {b.items.length === 0 ? (
                      <p style={{ marginTop: 10, opacity: 0.7 }}>（まだ何もない）</p>
                    ) : (
                      <ul style={{ marginTop: 10, paddingLeft: 0, listStyle: "none" }}>
                        {b.items.map((it) => (
                          <li
                            key={it.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              padding: "8px 10px",
                              border: "1px solid #f0f0f0",
                              borderRadius: 10,
                              marginBottom: 8,
                            }}
                          >
                            <label style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
                              <input type="checkbox" checked={it.done} onChange={() => toggleDone(b.key, it.id)} />
                              <span style={{ textDecoration: it.done ? "line-through" : "none" }}>
                                {it.title}
                                <span style={{ marginLeft: 8, opacity: 0.6, fontSize: 12 }}>
                                  ({it.estimate_min}m)
                                </span>
                              </span>
                            </label>

                            <button
                              style={{ border: "1px solid #ddd", borderRadius: 10, padding: "6px 10px" }}
                              onClick={() => deleteItem(b.key, it.id)}
                            >
                              削除
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </section>
          )}

          {/* Step 3: Final buttons */}
          <section style={{ marginTop: 14, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>最後に：コピー＆自走用プロンプト</h3>
            <p style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
              ここは最終回収ゾーン。チェックリストができたら、最後にプロンプトを発行して、コピペで自走。
            </p>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
                onClick={copyChecklistOnly}
                disabled={!buckets || buckets.length === 0}
              >
                チェックリストをコピー
              </button>

              <button
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
                onClick={generatePrompt}
                disabled={promptLoading || !buckets || buckets.length === 0}
              >
                {promptLoading ? "作成中…" : "プロンプト発行（最終）"}
              </button>

              <button
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
                onClick={copyPromptOnly}
                disabled={!prompt}
              >
                プロンプトだけコピー
              </button>

              <button
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
                onClick={copyChecklistAndPrompt}
                disabled={!buckets || buckets.length === 0}
              >
                チェックリスト＋プロンプトをコピー
              </button>
            </div>

            {promptError && <p style={{ marginTop: 10, color: "crimson" }}>{promptError}</p>}

            {prompt && (
              <textarea
                readOnly
                value={prompt}
                style={{
                  marginTop: 10,
                  width: "100%",
                  height: 190,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
              />
            )}
          </section>
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
