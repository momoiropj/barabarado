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

function buildBatonPassPromptMarkdown(args: {
  todo: string;
  context?: string;
  checklistMarkdown?: string; // ある場合だけ付与
}) {
  const todo = (args.todo ?? "").trim() || "(未設定)";
  const context = (args.context ?? "").trim();

  const checklistBlock = args.checklistMarkdown?.trim()
    ? `

---

## チェックリスト（BarabaraDoからのバトン）
以下は現時点でチェックリストになります。

${args.checklistMarkdown.trim()}
`
    : "";

  return `
## Prompt
あなたはユーザー専属の「実行支援AI」。BarabaraDoで作った下書き・分類・チェックリストを引き継いで、ユーザーが“次の5分”を迷わず始められるように伴走する。

### 最初の一言（必須）
最初の返答の冒頭は、必ずこの一文から始めて：
> OK，BarabaraDoからバトンパスされたよ！ここからは私がサポートするよ。

## 入力（BarabaraDoからのバトン）
- ToDo: ${todo}
- Context: ${context ? context : "(なし)"}

## やってほしいこと
1) まず「今日やる最初の5分」を1つだけ提案（行動が具体で、5分で確実に終わるもの）
2) ToDoの完了条件をユーザー向けに言い換え（YES/NOで判定できる形）
3) 優先順位（1〜7くらい）を提案し、理由を1行ずつ
4) 迷いが出た時にユーザーへ投げる質問を3つ（答えやすい形）
5) ユーザーが次にコピペして返せる「回答フォーマット」を提示（短く）

### 追加ルール
- 不明点があっても止まらない。仮定する場合は「仮定：〜」と明記。
- 質問は最大2つまで。ただし、質問の前に必ず仮の提案を出す。
- 説教・精神論で長引かせない。とにかく次の一歩を具体化。

## 返答フォーマット（この見出しで返して）
- 【今日やる最初の5分】
- 【優先順位の提案】
- 【迷いが出た時に聞くべき質問】
- 【次にコピペすべき回答フォーマット】
`.trim() + checklistBlock;
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
  const [issuedPrompt, setIssuedPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);

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
      setIssuedPrompt(saved.prompt ?? "");
    } else {
      setBuckets(null);
      setIssuedPrompt("");
    }
  }, [id]);

  const headerText = item ? item.title : "List";

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
    saveChecklist(id, next, issuedPrompt ?? "");
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
      saveChecklist(id, merged, issuedPrompt ?? "");
      showToast("AIで取り込んだ");
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
    saveChecklist(id, next, issuedPrompt ?? "");
  };

  const deleteItem = (bucketKey: string, itemId: string) => {
    if (!id || !buckets) return;
    const next = buckets.map((b) =>
      b.key !== bucketKey ? b : { ...b, items: (b.items ?? []).filter((it) => it.id !== itemId) }
    );
    setBuckets(next);
    saveChecklist(id, next, issuedPrompt ?? "");
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
    saveChecklist(id, next, issuedPrompt ?? "");
  };

  const formatChecklistMarkdown = () => {
    if (!item) return "";
    if (!buckets || buckets.length === 0) return "";

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

    return body.trim();
  };

  const generateIssuedPrompt = () => {
    if (!item || !id) return;
    if (!buckets || buckets.length === 0) return;

    setPromptLoading(true);
    try {
      const checklistMd = formatChecklistMarkdown();
      const p = buildBatonPassPromptMarkdown({
        todo: item.title,
        context: freeText,
        checklistMarkdown: checklistMd,
      });

      setIssuedPrompt(p);
      saveChecklist(id, buckets, p);
      showToast("プロンプト発行した");
    } finally {
      setPromptLoading(false);
    }
  };

  const copyText = async (text: string, msg: string) => {
    await navigator.clipboard.writeText(text);
    showToast(msg);
  };

  const copyPromptOnly = async () => {
    if (!issuedPrompt) return;
    await copyText(issuedPrompt, "プロンプトコピーした");
  };

  const copyChecklistOnly = async () => {
    const md = formatChecklistMarkdown();
    if (!md) return;
    await copyText(md, "チェックリストコピーした");
  };

  const copyChecklistAndPrompt = async () => {
    if (!item) return;

    let p = issuedPrompt ?? "";
    if (!p) {
      generateIssuedPrompt();
      p = issuedPrompt ?? "";
    }

    const checklist = formatChecklistMarkdown();
    const merged = `${p}\n\n---\n\n## Checklist\n**ToDo:** ${item.title}\n\n${checklist ? checklist : "_(No checklist yet)_"}\n`;
    await copyText(merged, "チェックリスト＋プロンプトコピーした");
  };

  return (
    <main className={styles.main}>
      <SiteHeader
        title={headerText}
        subtitle="下書き→分類→編集→プロンプト発行。発行したプロンプトを他AIにコピペして、伴走を続ける。"
        pills={[{ text: "🧸 ゲスト（端末保存）" }, { text: "🧠 分解 → 編集 → 発行" }]}
        navLinks={[
          { href: "/lists", label: "Lists" },
          { href: "/help", label: "Help" },
          { href: "/concept", label: "Concept" },
        ]}
      />

      <div className={styles.container}>
        {!item && notFound && <p className={styles.error}>このリストは見つからなかった（ゲスト保存にも無いみたい）。</p>}
        {!item && !notFound && <p className={styles.hint}>読み込み中…</p>}

        {item && (
          <>
            <section className={styles.card}>
              <div className={styles.cardInner}>
                <div className={styles.rowBetween}>
                  {!isEditingTitle ? (
                    <>
                      <h2 className={styles.h2}>{item.title}</h2>
                      <button
                        className={`${styles.btn} ${styles.btnGhost}`}
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
                        className={styles.input}
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        placeholder="タイトル"
                      />
                      <div className={styles.row}>
                        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveTitle}>
                          保存
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnGhost}`}
                          onClick={() => {
                            setTitleError("");
                            setTitleDraft(item.title);
                            setIsEditingTitle(false);
                          }}
                        >
                          キャンセル
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {titleError && <p className={styles.error}>{titleError}</p>}
                <p className={styles.meta}>id: {item.id}</p>
              </div>
            </section>

            {/* Step 1 */}
            <section className={styles.card}>
              <div className={styles.cardInner}>
                <h3 className={styles.sectionTitle}>まず自由に書く（下書き）</h3>
                <p className={styles.hint}>思いついた順でOK。箇条書き推奨。ここは “Context” としてプロンプトにも渡す。</p>

                <textarea
                  className={styles.textarea}
                  value={freeText}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFreeText(v);
                    if (id) saveDraft(id, v);
                  }}
                  placeholder={"例）\n・期限：来週\n・レシートが散らばってる\n・何が不安か\n・最初の5分でやること\n"}
                />

                <div className={styles.row} style={{ marginTop: 10 }}>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={categorizeMerge} disabled={catLoading}>
                    {catLoading ? "分類中…" : "AIで5カテゴリに分ける（取り込み）"}
                  </button>

                  <button className={`${styles.btn} ${styles.btnGhost}`} onClick={createEmptyChecklist}>
                    先に空のチェックリストを作る
                  </button>
                </div>

                {catError && <p className={styles.error}>{catError}</p>}
              </div>
            </section>

            {/* Step 2 */}
            {buckets && buckets.length > 0 && (
              <section className={styles.card}>
                <div className={styles.cardInner}>
                  <h3 className={styles.sectionTitle}>チェックリスト（編集OK）</h3>
                  <p className={styles.hint}>AI取り込み後も、手動で追加/削除/チェックできる。</p>

                  <div className={styles.bucketGrid}>
                    {buckets.map((b) => (
                      <section key={b.key} className={styles.bucketCard}>
                        <div className={styles.rowBetween}>
                          <h4 className={styles.bucketTitle}>{b.label}</h4>
                          <span className={styles.badge}>{(b.items ?? []).length}件</span>
                        </div>

                        <div className={styles.row} style={{ marginTop: 10 }}>
                          <input
                            className={styles.input}
                            value={addText[b.key] ?? ""}
                            onChange={(e) => setAddText((prev) => ({ ...prev, [b.key]: e.target.value }))}
                            placeholder="自分で追加…（Enterで追加）"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addItem(b.key);
                            }}
                          />
                          <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={() => addItem(b.key)}
                            disabled={!(addText[b.key] ?? "").trim()}
                          >
                            追加
                          </button>
                        </div>

                        {(b.items ?? []).length === 0 ? (
                          <p className={styles.hint} style={{ marginTop: 10 }}>
                            （まだ何もない）
                          </p>
                        ) : (
                          <ul className={styles.list}>
                            {(b.items ?? []).map((it) => (
                              <li key={it.id} className={styles.listItem}>
                                <label className={styles.checkRow}>
                                  <input type="checkbox" checked={it.done} onChange={() => toggleDone(b.key, it.id)} />
                                  <span className={it.done ? styles.done : ""}>
                                    {it.title}
                                    <span className={styles.est}>({it.estimate_min}m)</span>
                                  </span>
                                </label>

                                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => deleteItem(b.key, it.id)}>
                                  削除
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Step 3 */}
            <section className={styles.card}>
              <div className={styles.cardInner}>
                <h3 className={styles.sectionTitle}>最後に：プロンプト発行（他AIへコピペ）</h3>
                <p className={styles.hint}>発行したプロンプトをそのまま他AIへ貼って、伴走を続ける。</p>

                <div className={styles.row} style={{ marginTop: 10 }}>
                  <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => router.push("/lists")}>
                    ← Listsに戻る
                  </button>

                  <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={generateIssuedPrompt}
                    disabled={promptLoading || !buckets || buckets.length === 0}
                  >
                    {promptLoading ? "作成中…" : "プロンプト発行（最終）"}
                  </button>

                  <button className={`${styles.btn} ${styles.btnGhost}`} onClick={copyPromptOnly} disabled={!issuedPrompt}>
                    プロンプトだけコピー（Markdown）
                  </button>

                  <button className={`${styles.btn} ${styles.btnGhost}`} onClick={copyChecklistOnly} disabled={!buckets || buckets.length === 0}>
                    チェックリストをコピー（Markdown）
                  </button>

                  <button className={`${styles.btn} ${styles.btnGhost}`} onClick={copyChecklistAndPrompt} disabled={!buckets || buckets.length === 0}>
                    チェックリスト＋プロンプトをコピー（Markdown）
                  </button>
                </div>

                {issuedPrompt && (
                  <textarea className={styles.textareaTall} readOnly value={issuedPrompt} />
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </main>
  );
}
