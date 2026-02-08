"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import styles from "./page.module.css";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parsed
    .map((x: any) => ({
      id: String(x?.id ?? ""),
      title: String(x?.title ?? ""),
      createdAt: String(x?.createdAt ?? ""),
      updatedAt: String(x?.updatedAt ?? ""),
    }))
    .filter((x) => x.id && x.title);
}

function saveGuestLists(lists: ListRow[]) {
  try {
    localStorage.setItem(GUEST_LISTS_KEY, JSON.stringify(lists));
  } catch {}
}

function updateGuestListTitle(listId: string, newTitle: string) {
  const lists = loadGuestLists();
  const next = lists.map((l) => (l.id === listId ? { ...l, title: newTitle, updatedAt: new Date().toISOString() } : l));
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

function formatChecklistMarkdown(todoTitle: string, buckets: Bucket[] | null): string {
  const header = `## Checklist\n**ToDo:** ${todoTitle}\n\n`;
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
}

function buildBatonPassPromptMarkdown(args: {
  todoTitle: string;
  contextText: string;
  basePrompt: string;
  checklistMarkdown?: string;
}): string {
  const { todoTitle, contextText, basePrompt, checklistMarkdown } = args;

  const ctx = (contextText ?? "").trim();
  const hasChecklist = Boolean(checklistMarkdown && checklistMarkdown.trim().length > 0);

  return [
    `# BarabaraDo → あなた（AI）へのバトンパス`,
    ``,
    `あなたは「タスク分解と実行支援」が得意なAIコーチ。これからユーザーを伴走して、行動できる状態にする。`,
    ``,
    `## まず最初に言うセリフ（固定）`,
    `次の一言から必ず始めて：`,
    `> OK，BarabaraDoからバトンパスされたよ！ここからは私がサポートするよ。`,
    ``,
    `## 進め方（大事ルール）`,
    `- いきなり説教しない。短く、具体、即実行。`,
    `- 質問は最大2つ。ただし質問の前に、あなたの仮案（次の一手）を必ず出す。`,
    `- ユーザーの状況に合わせて、チェックリストを「より現実的」に書き換えていい（むしろやって）。`,
    `- 最後に「今日やる最初の5分」を提案して、ユーザーに選ばせる。`,
    ``,
    `## ユーザーのToDo`,
    `- ToDo: ${todoTitle}`,
    ctx ? `- 補足: ${ctx}` : `- 補足: （なし）`,
    ``,
    `## BarabaraDoのたたき台（この案を改善してOK）`,
    basePrompt?.trim() ? basePrompt.trim() : "_(BarabaraDoの案が空でした。あなたがゼロから組み立ててOK)_",
    ``,
    hasChecklist ? `## 以下は現時点でチェックリストになります。` : `## チェックリスト`,
    hasChecklist ? checklistMarkdown!.trim() : `_(チェックリスト未生成)_`,
    ``,
    `## あなた（AI）の出力フォーマット（おすすめ）`,
    `1) 最初の一言（上の固定セリフ）`,
    `2) 状況を掴む短い確認（最大2問）`,
    `3) いまからやる「最初の5分」提案（3択）`,
    `4) カスタム後のチェックリスト（Markdownのチェックボックスで）`,
    ``,
  ].join("\n");
}

export default function Page() {
  const router = useRouter();
  const params = useParams();
  const id = useMemo(() => String((params as any)?.id ?? ""), [params]);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  };

  const [item, setItem] = useState<ListRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  // step1 draft
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

  // prompt (issued)
  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState("");

  useEffect(() => {
    if (!id) return;

    const lists = loadGuestLists();
    const found = lists.find((l) => l.id === id) ?? null;
    setItem(found);
    setNotFound(!found);

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
    showToast("タイトル更新した");
  };

  const createEmptyChecklist = () => {
    if (!id) return;
    const next = baseBuckets();
    setBuckets(next);
    saveChecklist(id, next, prompt ?? "");
    showToast("空のチェックリスト作った");
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
      showToast("分類した（取り込み）");
    } catch (e: any) {
      setCatError(e?.message ?? "Failed");
    } finally {
      setCatLoading(false);
    }
  };

  const toggleDone = (bucketKey: string, itemId: string) => {
    if (!id || !buckets) return;
    const next = buckets.map((b) =>
      b.key !== bucketKey ? b : { ...b, items: (b.items ?? []).map((it) => (it.id === itemId ? { ...it, done: !it.done } : it)) }
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
    showToast("追加した");
  };

  // ✅ ここが「発行ボタン」：サーバーでベース案生成→バトンパス用Markdownに包む
  const generatePrompt = async (): Promise<string | null> => {
    if (!item || !id) return null;

    setPromptError("");
    setPromptLoading(true);

    try {
      const res = await fetch("/api/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: item.title,
          title: item.title,
          buckets: buckets ?? baseBuckets(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "API error");

      const basePrompt = String(data?.prompt ?? "");

      const checklistMd = formatChecklistMarkdown(item.title, buckets ?? null);
      const issued = buildBatonPassPromptMarkdown({
        todoTitle: item.title,
        contextText: freeText ?? "",
        basePrompt,
        checklistMarkdown: checklistMd,
      });

      setPrompt(issued);
      saveChecklist(id, buckets ?? null, issued);
      showToast("プロンプト発行した");
      return issued;
    } catch (e: any) {
      setPromptError(e?.message ?? "Failed");
      return null;
    } finally {
      setPromptLoading(false);
    }
  };

  const copyText = async (text: string, msg: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    showToast(msg);
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <SiteHeader
          title={headerText}
          subtitle="下書き→分類→編集→プロンプト発行。発行したプロンプトを他AIにコピペして、伴走を続ける。"
          pills={[{ text: "🧸 BarabaraDo（ゲスト）" }, { text: "🧠 分解 → 編集 → 発行" }]}
          navLinks={[
            { href: "/lists", label: "← Lists" },
            { href: "/help", label: "📘 Help" },
            { href: "/concept", label: "💡 Concept" },
          ]}
        />

        <p className={styles.hint}>ゲストモード：この端末のブラウザ内に保存されるよ</p>

        {item && (
          <section className={styles.card}>
            <div className={styles.cardInner}>
              {/* Title + edit */}
              <div className={styles.titleRow}>
                {!isEditingTitle ? (
                  <>
                    <h2 className={styles.listTitle}>{item.title}</h2>
                    <button
                      className={styles.btn}
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
                      className={styles.input}
                      style={{ flex: 1, minWidth: 220 }}
                    />
                    <button className={styles.btnPrimary} onClick={saveTitle}>
                      保存
                    </button>
                    <button
                      className={styles.btn}
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

              {titleError && <p className={styles.error}>{titleError}</p>}
              <p className={styles.meta}>id: {item.id}</p>

              {/* Step 1 */}
              <section className={styles.subCard}>
                <h3 className={styles.sectionTitle}>まず自由に書く（下書き）</h3>
                <p className={styles.sectionHint}>思いついた順でOK。箇条書き推奨。AIで分類しても消えない。</p>

                <textarea
                  value={freeText}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFreeText(v);
                    if (id) saveDraft(id, v);
                  }}
                  placeholder={"例）\n・片付けたい理由を言語化\n・捨てる基準を決める\n・ゴミ袋を買う\n"}
                  className={styles.textarea}
                />

                <div className={styles.actions}>
                  <button className={styles.btnPrimary} onClick={categorizeMerge} disabled={catLoading}>
                    {catLoading ? "分類中…" : "AIで5カテゴリに分ける（取り込み）"}
                  </button>

                  <button className={styles.btn} onClick={createEmptyChecklist}>
                    先に空のチェックリストを作る
                  </button>
                </div>

                {catError && <p className={styles.error}>{catError}</p>}
              </section>

              {/* Step 2 */}
              {buckets && buckets.length > 0 && (
                <section style={{ marginTop: 14 }}>
                  <h3 className={styles.sectionTitle}>チェックリスト（編集OK）</h3>
                  <p className={styles.sectionHint}>AI分類後も、手動で追加/削除/チェックできる。</p>

                  <div className={styles.bucketGrid}>
                    {buckets.map((b) => (
                      <section key={b.key} className={styles.bucketCard}>
                        <div className={styles.bucketHeader}>
                          <h4 className={styles.bucketTitle}>{b.label}</h4>
                          <button className={styles.btn} onClick={() => setAddText((prev) => ({ ...prev, [b.key]: prev[b.key] ?? "" }))}>
                            ＋追加
                          </button>
                        </div>

                        <div className={styles.addRow}>
                          <input
                            value={addText[b.key] ?? ""}
                            onChange={(e) => setAddText((prev) => ({ ...prev, [b.key]: e.target.value }))}
                            placeholder="自分で追加…（Enterで追加）"
                            className={styles.input}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addItem(b.key);
                            }}
                          />
                          <button className={styles.btnPrimary} onClick={() => addItem(b.key)} disabled={!(addText[b.key] ?? "").trim()}>
                            追加
                          </button>
                        </div>

                        {(b.items ?? []).length === 0 ? (
                          <p className={styles.sectionHint} style={{ marginTop: 10 }}>
                            （まだ何もない）
                          </p>
                        ) : (
                          <ul className={styles.items}>
                            {(b.items ?? []).map((it) => (
                              <li key={it.id} className={styles.itemRow}>
                                <label className={styles.itemLabel}>
                                  <input type="checkbox" checked={it.done} onChange={() => toggleDone(b.key, it.id)} />
                                  <span style={{ textDecoration: it.done ? "line-through" : "none" }}>
                                    {it.title}
                                    <span className={styles.itemMeta}>({it.estimate_min}m)</span>
                                  </span>
                                </label>

                                <button className={styles.btnDanger} onClick={() => deleteItem(b.key, it.id)}>
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

              {/* Step 3 */}
              <section className={styles.subCard} style={{ marginTop: 14 }}>
                <h3 className={styles.sectionTitle}>最後に：コピー＆バトンパス用プロンプト</h3>
                <p className={styles.sectionHint}>
                  「プロンプト発行（最終）」で、他AIにそのまま渡せるMarkdownを生成する（チェックリスト付き）。
                </p>

                <div className={styles.actions}>
                  <button
                    className={styles.btn}
                    onClick={() => copyText(formatChecklistMarkdown(item.title, buckets ?? null), "チェックリストコピーした")}
                    disabled={!buckets || buckets.length === 0}
                  >
                    チェックリストをコピー（Markdown）
                  </button>

                  <button className={styles.btnPrimary} onClick={generatePrompt} disabled={promptLoading}>
                    {promptLoading ? "作成中…" : "プロンプト発行（最終）"}
                  </button>

                  <button className={styles.btn} onClick={() => copyText(prompt, "プロンプトコピーした")} disabled={!prompt}>
                    プロンプトだけコピー（Markdown）
                  </button>

                  <button
                    className={styles.btn}
                    onClick={async () => {
                      let p = prompt ?? "";
                      if (!p) {
                        const generated = await generatePrompt();
                        p = generated ?? "";
                      }
                      if (p) await copyText(p, "チェックリスト込みプロンプトをコピーした");
                    }}
                  >
                    チェックリスト＋プロンプトをコピー（※プロンプト内に含む）
                  </button>
                </div>

                {promptError && <p className={styles.error}>{promptError}</p>}

                {prompt && (
                  <textarea readOnly value={prompt} className={styles.textarea} style={{ height: 260, marginTop: 10 }} />
                )}
              </section>
            </div>
          </section>
        )}

        {!item && notFound && <p className={styles.error}>このリストは見つからなかった（ゲスト保存にも無いみたい）。</p>}
        {!item && !notFound && <p className={styles.hint}>読み込み中…</p>}

        {toast && <div className={styles.toast}>{toast}</div>}
      </div>
    </main>
  );
}
