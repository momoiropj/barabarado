"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ListRow = {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
};

type ChecklistItem = {
  id: string;
  title: string;
  estimate_min: number;
  done: boolean;
};

type Bucket = {
  key: string;
  label: string;
  items: ChecklistItem[];
};

const GUEST_LISTS_KEY = "bbdo_guest_lists_v1";
const checklistKey = (listId: string) => `barabarado_checklist_v3_${listId}`;
const draftKey = (listId: string) => `barabarado_draft_${listId}`;

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function uid(): string {
  // crypto.randomUUID が無い環境もあるのでフォールバック
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function baseBuckets(): Bucket[] {
  return [
    { key: "motivation", label: "気持ち・理由（Why）", items: [] },
    { key: "plan", label: "現状・課題・制約（As-is）", items: [] },
    { key: "budget", label: "予算・時間・リソース", items: [] },
    { key: "procedure", label: "手順・やり方（How）", items: [] },
    { key: "setup", label: "メモ・その他", items: [] },
  ];
}

function normalizeBuckets(input: unknown): Bucket[] | null {
  if (!Array.isArray(input)) return null;
  return input.map((b: any) => ({
    key: String(b?.key ?? uid()),
    label: String(b?.label ?? ""),
    items: Array.isArray(b?.items)
      ? b.items.map((it: any) => ({
          id: String(it?.id ?? uid()),
          title: String(it?.title ?? ""),
          estimate_min: Number.isFinite(Number(it?.estimate_min)) ? Number(it.estimate_min) : 5,
          done: Boolean(it?.done),
        }))
      : [],
  }));
}

function loadGuestLists(): ListRow[] {
  const parsed = safeParseJSON<unknown>(localStorage.getItem(GUEST_LISTS_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((x: any) => ({ id: String(x?.id ?? ""), title: String(x?.title ?? "") }))
    .filter((x) => x.id && x.title);
}

function saveGuestLists(lists: ListRow[]) {
  try {
    localStorage.setItem(GUEST_LISTS_KEY, JSON.stringify(lists));
  } catch {}
}

function updateGuestListTitle(listId: string, newTitle: string) {
  const lists = loadGuestLists();
  const next = lists.map((l) => (l.id === listId ? { ...l, title: newTitle } : l));
  saveGuestLists(next);
}

function loadChecklist(listId: string): { buckets: Bucket[] | null; prompt: string } | null {
  const parsed = safeParseJSON<any>(localStorage.getItem(checklistKey(listId)));
  if (!parsed) return null;

  const buckets = normalizeBuckets(parsed?.buckets);
  const prompt = String(parsed?.prompt ?? "");
  return { buckets, prompt };
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

function loadDraft(listId: string): string {
  try {
    return localStorage.getItem(draftKey(listId)) ?? "";
  } catch {
    return "";
  }
}

function saveDraft(listId: string, text: string) {
  try {
    localStorage.setItem(draftKey(listId), text ?? "");
  } catch {}
}

export default function Page() {
  const router = useRouter();
  const params = useParams();
  const id = useMemo(() => String((params as any)?.id ?? ""), [params]);

  const [item, setItem] = useState<ListRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  // step1
  const [freeText, setFreeText] = useState("");

  // checklist
  const [buckets, setBuckets] = useState<Bucket[] | null>(null);

  // add
  const [addText, setAddText] = useState<Record<string, string>>({});

  // title edit
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleError, setTitleError] = useState("");

  // categorize
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState("");

  // prompt
  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState("");

  useEffect(() => {
    if (!id) return;

    // guest listから探す（まずはこれだけで成立させる）
    const lists = loadGuestLists();
    const found = lists.find((l) => l.id === id) ?? null;
    setItem(found);
    setNotFound(!found);

    // draft/checklist復元
    setFreeText(loadDraft(id));

    const saved = loadChecklist(id);
    if (saved?.buckets) {
      setBuckets(saved.buckets);
      setPrompt(saved.prompt ?? "");
    } else {
      setBuckets(null);
      setPrompt("");
    }
  }, [id]);

  const headerText = item ? `List: ${item.title}` : "List";

  const saveTitle = () => {
    if (!item || !id) return;
    const t = titleDraft.trim();
    if (!t) {
      setTitleError("タイトルが空だよ");
      return;
    }
    setTitleError("");
    setItem({ ...item, title: t });
    updateGuestListTitle(id, t);
    setIsEditingTitle(false);
  };

  const createEmptyChecklist = () => {
    if (!id) return;
    const next = baseBuckets();
    setBuckets(next);
    saveChecklist(id, next, prompt ?? "");
  };

  const categorizeMerge = async () => {
    if (!id) return;
    setCatError("");
    setCatLoading(true);

    try {
      const current = buckets ?? baseBuckets();
      const res = await fetch("/api/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: item?.title ?? "",
          text: freeText ?? "",
          buckets: current,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "API error");

      const merged = normalizeBuckets(data?.buckets);
      if (!merged) throw new Error("Invalid response");

      setBuckets(merged);
      saveChecklist(id, merged, prompt ?? "");
    } catch (e: any) {
      setCatError(e?.message ?? "Failed");
    } finally {
      setCatLoading(false);
    }
  };

  const toggleDone = (bucketKey: string, itemId: string) => {
    if (!id || !buckets) return;
    const next = buckets.map((b) =>
      b.key !== bucketKey
        ? b
        : { ...b, items: (b.items ?? []).map((it) => (it.id === itemId ? { ...it, done: !it.done } : it)) }
    );
    setBuckets(next);
    saveChecklist(id, next, prompt ?? "");
  };

  const deleteItem = (bucketKey: string, itemId: string) => {
    if (!id || !buckets) return;
    const next = buckets.map((b) => (b.key !== bucketKey ? b : { ...b, items: (b.items ?? []).filter((it) => it.id !== itemId) }));
    setBuckets(next);
    saveChecklist(id, next, prompt ?? "");
  };

  const addItem = (bucketKey: string) => {
    if (!id) return;
    const text = String(addText[bucketKey] ?? "").trim();
    if (!text) return;

    const current = buckets ?? baseBuckets();
    const newItem: ChecklistItem = { id: uid(), title: text, estimate_min: 5, done: false };

    const next = current.map((b) => (b.key !== bucketKey ? b : { ...b, items: [...(b.items ?? []), newItem] }));
    setBuckets(next);
    setAddText((prev) => ({ ...prev, [bucketKey]: "" }));
    saveChecklist(id, next, prompt ?? "");
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
        body: JSON.stringify({
          goal: item.title,
          title: item.title,
          buckets,
        }),
      });

      const data = await res.json().catch(() => ({}));
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

  // ===== Markdown copy =====
  const formatChecklistMarkdown = () => {
    if (!item) return "";
    const header = `## Checklist\n**ToDo:** ${item.title}\n\n`;
    if (!buckets || buckets.length === 0) return header + "_(No checklist yet)_\n";

    const body =
      buckets
        .map((b) => {
          const head = b.label ? `### ${b.label}\n` : "";
          const lines = (b.items ?? []).map((it) => {
            const mark = it.done ? "x" : " ";
            const est = typeof it.estimate_min === "number" ? ` (${it.estimate_min}m)` : "";
            return `- [${mark}] ${it.title}${est}`;
          });
          return head + (lines.length ? lines.join("\n") : "- [ ] (empty)");
        })
        .join("\n\n") + "\n";

    return header + body;
  };

  const formatPromptMarkdown = (p: string) => `## Prompt\n${p}\n`;

  const copyChecklistOnly = async () => {
    const md = formatChecklistMarkdown();
    if (!md) return;
    await navigator.clipboard.writeText(md);
    alert("Copied checklist (Markdown)");
  };

  const copyPromptOnly = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(formatPromptMarkdown(prompt));
    alert("Copied prompt (Markdown)");
  };

  const copyChecklistAndPrompt = async () => {
    if (!item) return;

    let p = prompt ?? "";
    if (!p) {
      const ok = confirm("No prompt yet. Generate it now and copy together?");
      if (!ok) {
        await copyChecklistOnly();
        return;
      }
      const generated = await generatePrompt();
      p = generated ?? "";
    }

    const md = `${formatPromptMarkdown(p)}\n---\n\n${formatChecklistMarkdown()}`;
    await navigator.clipboard.writeText(md);
    alert("Copied checklist + prompt (Markdown)");
  };

  return (
    <main style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <button style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 12px" }} onClick={() => router.push("/lists")}>
        ← Back
      </button>

      <h1 style={{ marginTop: 16, fontSize: 28, fontWeight: 700 }}>{headerText}</h1>

      <p style={{ marginTop: 8, opacity: 0.8 }}>ゲストモード：この端末のブラウザ内に保存されるよ</p>

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
            <p style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>思いついた順でOK。箇条書き推奨。AIで分類しても消えない。</p>

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
              <button style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }} onClick={categorizeMerge} disabled={catLoading}>
                {catLoading ? "分類中…" : "AIで5カテゴリに分ける（取り込み）"}
              </button>

              <button style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }} onClick={createEmptyChecklist}>
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

                    {(b.items ?? []).length === 0 ? (
                      <p style={{ marginTop: 10, opacity: 0.7 }}>（まだ何もない）</p>
                    ) : (
                      <ul style={{ marginTop: 10, paddingLeft: 0, listStyle: "none" }}>
                        {(b.items ?? []).map((it) => (
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
                                <span style={{ marginLeft: 8, opacity: 0.6, fontSize: 12 }}>({it.estimate_min}m)</span>
                              </span>
                            </label>

                            <button style={{ border: "1px solid #ddd", borderRadius: 10, padding: "6px 10px" }} onClick={() => deleteItem(b.key, it.id)}>
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
              <button style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }} onClick={copyChecklistOnly} disabled={!buckets || buckets.length === 0}>
                チェックリストをコピー（Markdown）
              </button>

              <button style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }} onClick={generatePrompt} disabled={promptLoading || !buckets || buckets.length === 0}>
                {promptLoading ? "作成中…" : "プロンプト発行（最終）"}
              </button>

              <button style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }} onClick={copyPromptOnly} disabled={!prompt}>
                プロンプトだけコピー（Markdown）
              </button>

              <button style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }} onClick={copyChecklistAndPrompt} disabled={!buckets || buckets.length === 0}>
                チェックリスト＋プロンプトをコピー（Markdown）
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
          このリストは見つからなかった（ゲスト保存にも無いみたい）。
        </p>
      )}

      {!item && !notFound && <p style={{ marginTop: 16, opacity: 0.8 }}>読み込み中…</p>}
    </main>
  );
}





