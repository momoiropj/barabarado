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

type TaskItem = {
  id: string;
  text: string;
  done: boolean;
  bucket: "inbox" | "today" | "week" | "someday";
  createdAt: string;
};

const GUEST_LISTS_KEY = "bbdo_guest_lists_v1";
const ITEMS_KEY_PREFIX = "bbdo_guest_items_v1_";
const DRAFT_KEY_PREFIX = "bbdo_guest_draft_v1_";
const ISSUED_PROMPT_KEY_PREFIX = "bbdo_guest_issued_prompt_v1_";

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

function loadGuestLists(): ListRow[] {
  const parsed = safeParseJSON<unknown>(localStorage.getItem(GUEST_LISTS_KEY));
  if (!Array.isArray(parsed)) return [];
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
  localStorage.setItem(GUEST_LISTS_KEY, JSON.stringify(lists));
}

function loadTasks(listId: string): TaskItem[] {
  const parsed = safeParseJSON<unknown>(localStorage.getItem(`${ITEMS_KEY_PREFIX}${listId}`));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((x: any) => ({
      id: String(x?.id ?? uid()),
      text: String(x?.text ?? ""),
      done: Boolean(x?.done ?? false),
      bucket: (x?.bucket ?? "inbox") as TaskItem["bucket"],
      createdAt: String(x?.createdAt ?? new Date().toISOString()),
    }))
    .filter((t) => t.text);
}

function saveTasks(listId: string, tasks: TaskItem[]) {
  localStorage.setItem(`${ITEMS_KEY_PREFIX}${listId}`, JSON.stringify(tasks));
}

function loadDraft(listId: string): string {
  return localStorage.getItem(`${DRAFT_KEY_PREFIX}${listId}`) ?? "";
}

function saveDraft(listId: string, draft: string) {
  localStorage.setItem(`${DRAFT_KEY_PREFIX}${listId}`, draft);
}

function loadIssuedPrompt(listId: string): string {
  return localStorage.getItem(`${ISSUED_PROMPT_KEY_PREFIX}${listId}`) ?? "";
}

function saveIssuedPrompt(listId: string, prompt: string) {
  localStorage.setItem(`${ISSUED_PROMPT_KEY_PREFIX}${listId}`, prompt);
}

/**
 * BarabaradoのAI分解結果から、メモ帳コピペ用チェックリストっぽい行を抽出する
 * - [ ] 〜 の行を優先
 */
function extractChecklistLines(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const checks = lines
    .map((l) => {
      const m = l.match(/^- \[\s*\]\s*(.+)$/);
      return m ? m[1].trim() : null;
    })
    .filter(Boolean) as string[];

  if (checks.length > 0) return checks;

  // フォールバック：箇条書きっぽい行
  const bullets = lines
    .map((l) => {
      const m = l.match(/^[-•]\s+(.+)$/);
      return m ? m[1].trim() : null;
    })
    .filter(Boolean) as string[];

  return bullets.slice(0, 20);
}

function buildIssuedPromptMarkdown(params: {
  todoTitle: string;
  draft: string;
  tasks: TaskItem[];
}): string {
  const { todoTitle, draft, tasks } = params;

  const checklist =
    tasks.length > 0
      ? [
          "以下は現時点でチェックリストになります。",
          "",
          ...tasks.map((t) => `- [ ] ${t.text}`),
        ].join("\n")
      : "";

  return [
    "## Prompt",
    "",
    "あなたはユーザーのパーソナルAIコーチ。",
    "以下はBarabaraDoからバトンパスされた情報。",
    "最初に必ず、次の一言から始める：",
    "「OK，BarabaraDoからバトンパスされたよ！ここからは私がサポートするよ」",
    "",
    "次に、ユーザーに合わせてチェックリストを最適化し、今日の最初の一手（5〜15分）を提案する。",
    "迷いが出た時の質問（最大2つ）も添える。",
    "",
    "### ToDo",
    `- ${todoTitle}`,
    "",
    "### User Draft (任意のメモ)",
    draft ? `- ${draft.replace(/\r?\n/g, "\n- ")}` : "- （空）",
    "",
    checklist ? "### Checklist" : "",
    checklist ? checklist : "",
    "",
    "### あなたの出力フォーマット",
    "1) 最初の一手（5〜15分）×3",
    "2) 今日やる順番（優先順位）",
    "3) チェックリストの改善案（追加・削除・並び替え）",
    "4) 迷ったときの質問（最大2つ）",
    "",
  ]
    .filter((x) => x !== "")
    .join("\n");
}

export default function Page() {
  const router = useRouter();
  const params = useParams();
  const rawId = (params as any)?.id as string | string[] | undefined;
  const listId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  };

  const [listTitle, setListTitle] = useState<string>("");

  const [draft, setDraft] = useState<string>("");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTaskText, setNewTaskText] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  const [issuedPrompt, setIssuedPrompt] = useState<string>("");

  useEffect(() => {
    if (!listId) return;

    const lists = loadGuestLists();
    const row = lists.find((l) => l.id === listId);
    setListTitle(row?.title ?? "");

    setDraft(loadDraft(listId));
    setTasks(loadTasks(listId));
    setIssuedPrompt(loadIssuedPrompt(listId));
  }, [listId]);

  const titleForHeader = useMemo(() => {
    const t = (listTitle || "リスト").trim();
    return `${t} を作る`;
  }, [listTitle]);

  const grouped = useMemo(() => {
    const base = {
      inbox: [] as TaskItem[],
      today: [] as TaskItem[],
      week: [] as TaskItem[],
      someday: [] as TaskItem[],
    };

    for (const t of tasks) base[t.bucket].push(t);

    const sortFn = (a: TaskItem, b: TaskItem) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.createdAt.localeCompare(b.createdAt);
    };

    base.inbox.sort(sortFn);
    base.today.sort(sortFn);
    base.week.sort(sortFn);
    base.someday.sort(sortFn);

    return base;
  }, [tasks]);

  const persistTasks = (next: TaskItem[]) => {
    setTasks(next);
    if (listId) saveTasks(listId, next);
  };

  const persistDraft = (next: string) => {
    setDraft(next);
    if (listId) saveDraft(listId, next);
  };

  const toggleDone = (id: string) => {
    const next = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    persistTasks(next);
  };

  const changeBucket = (id: string, bucket: TaskItem["bucket"]) => {
    const next = tasks.map((t) => (t.id === id ? { ...t, bucket } : t));
    persistTasks(next);
  };

  const removeTask = (id: string) => {
    const next = tasks.filter((t) => t.id !== id);
    persistTasks(next);
  };

  const addTask = (bucket: TaskItem["bucket"]) => {
    setError("");
    const text = newTaskText.trim();
    if (!text) {
      setError("タスクを入れてね");
      return;
    }
    const now = new Date().toISOString();
    const next: TaskItem[] = [{ id: uid(), text, done: false, bucket, createdAt: now }, ...tasks];
    persistTasks(next);
    setNewTaskText("");
    showToast("追加した");
  };

  const runBreakdown = async () => {
    if (!listId) return;
    setError("");
    const todo = (draft || listTitle || "").trim();
    if (!todo) {
      setError("まずは下書き（またはタイトル）を書いてね");
      return;
    }

    try {
      setBusy(true);

      const res = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todo, context: "" }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const data = await res.json().catch(() => ({} as any));
      const text: string =
        String((data as any)?.text ?? (data as any)?.result ?? (data as any)?.message ?? "");

      const lines = extractChecklistLines(text);
      if (lines.length === 0) {
        setError("分解は返ってきたけど、チェックリスト行が抽出できなかった…（表示内容を見て調整しよ）");
        return;
      }

      const now = new Date().toISOString();
      const added: TaskItem[] = lines.map((l) => ({
        id: uid(),
        text: l,
        done: false,
        bucket: "inbox",
        createdAt: now,
      }));

      persistTasks([...added, ...tasks]);
      showToast("チェックリスト追加した");
    } catch (e: any) {
      setError(`AI分解でコケた：${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const issuePrompt = async () => {
    if (!listId) return;
    setError("");

    const p = buildIssuedPromptMarkdown({
      todoTitle: listTitle || "リスト",
      draft,
      tasks,
    });

    setIssuedPrompt(p);
    saveIssuedPrompt(listId, p);
    showToast("プロンプト発行した");
  };

  const copyToClipboard = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(okMsg);
    } catch {
      setError("コピーできなかった（ブラウザの権限/HTTPSを確認してね）");
    }
  };

  if (!listId) {
    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <p className={styles.hint}>IDが取れなかった…URLを確認してね</p>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => router.push("/lists")}>
            ← Listsへ
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <SiteHeader
        title={titleForHeader}
        subtitle="下書き → 分解 → チェックリスト化 → プロンプト発行（他AIへバトンパス）"
        backHref="/lists"
        backLabel="← Lists"
        navLinks={[
          { href: "/help", label: "Help" },
          { href: "/concept", label: "Concept" },
        ]}
        statusLines={[
          { icon: "🧸", text: "ゲストモード" },
          { icon: "🔒", text: "この端末のブラウザに保存します" },
        ]}
      />

      <main className={styles.main}>
        <div className={styles.container}>
          {/* 下書き */}
          <section className={styles.card}>
            <div className={styles.cardInner}>
              <h2 className={styles.h2}>下書き</h2>
              <p className={styles.hint}>1行でもOK。ここからAI分解して、タスクに落とす。</p>

              <textarea
                className={styles.textarea}
                value={draft}
                onChange={(e) => persistDraft(e.target.value)}
                placeholder="例）ビリヤニ作りたい。材料買う→仕込み→炊く→盛り付け→写真撮る…みたいに"
              />

              <div className={styles.row}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={runBreakdown} disabled={busy}>
                  {busy ? "分解中…" : "AIで分解してチェックリスト追加"}
                </button>

                <button className={styles.btn} onClick={issuePrompt} disabled={busy}>
                  プロンプト発行
                </button>
              </div>

              {error ? <p className={styles.error}>{error}</p> : null}
            </div>
          </section>

          {/* 追加 */}
          <section className={styles.card}>
            <div className={styles.cardInner}>
              <h2 className={styles.h2}>タスク追加</h2>
              <div className={styles.row} style={{ marginTop: 10 }}>
                <input
                  className={styles.input}
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder="例）鶏肉をヨーグルトに漬ける / スパイスを計量する"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTask("inbox");
                  }}
                />
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => addTask("inbox")}>
                  ＋Inbox
                </button>
              </div>
            </div>
          </section>

          {/* チェックリスト */}
          <section className={styles.card}>
            <div className={styles.cardInner}>
              <h2 className={styles.h2}>チェックリスト</h2>
              <p className={styles.hint}>チェック→移動→削除。優先度は「Today」に寄せる。</p>

              <div className={styles.bucketGrid}>
                <div className={styles.bucket}>
                  <div className={styles.bucketTitle}>Inbox</div>
                  {grouped.inbox.length === 0 ? <div className={styles.empty}>（なし）</div> : null}
                  {grouped.inbox.map((t) => (
                    <div key={t.id} className={styles.taskRow}>
                      <label className={styles.check}>
                        <input type="checkbox" checked={t.done} onChange={() => toggleDone(t.id)} />
                        <span className={t.done ? styles.done : ""}>{t.text}</span>
                      </label>

                      <div className={styles.taskActions}>
                        <select
                          className={styles.select}
                          value={t.bucket}
                          onChange={(e) => changeBucket(t.id, e.target.value as TaskItem["bucket"])}
                        >
                          <option value="inbox">Inbox</option>
                          <option value="today">Today</option>
                          <option value="week">This Week</option>
                          <option value="someday">Someday</option>
                        </select>
                        <button className={styles.iconBtn} onClick={() => removeTask(t.id)} aria-label="delete">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.bucket}>
                  <div className={styles.bucketTitle}>Today</div>
                  {grouped.today.length === 0 ? <div className={styles.empty}>（なし）</div> : null}
                  {grouped.today.map((t) => (
                    <div key={t.id} className={styles.taskRow}>
                      <label className={styles.check}>
                        <input type="checkbox" checked={t.done} onChange={() => toggleDone(t.id)} />
                        <span className={t.done ? styles.done : ""}>{t.text}</span>
                      </label>

                      <div className={styles.taskActions}>
                        <select
                          className={styles.select}
                          value={t.bucket}
                          onChange={(e) => changeBucket(t.id, e.target.value as TaskItem["bucket"])}
                        >
                          <option value="inbox">Inbox</option>
                          <option value="today">Today</option>
                          <option value="week">This Week</option>
                          <option value="someday">Someday</option>
                        </select>
                        <button className={styles.iconBtn} onClick={() => removeTask(t.id)} aria-label="delete">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.bucket}>
                  <div className={styles.bucketTitle}>This Week</div>
                  {grouped.week.length === 0 ? <div className={styles.empty}>（なし）</div> : null}
                  {grouped.week.map((t) => (
                    <div key={t.id} className={styles.taskRow}>
                      <label className={styles.check}>
                        <input type="checkbox" checked={t.done} onChange={() => toggleDone(t.id)} />
                        <span className={t.done ? styles.done : ""}>{t.text}</span>
                      </label>

                      <div className={styles.taskActions}>
                        <select
                          className={styles.select}
                          value={t.bucket}
                          onChange={(e) => changeBucket(t.id, e.target.value as TaskItem["bucket"])}
                        >
                          <option value="inbox">Inbox</option>
                          <option value="today">Today</option>
                          <option value="week">This Week</option>
                          <option value="someday">Someday</option>
                        </select>
                        <button className={styles.iconBtn} onClick={() => removeTask(t.id)} aria-label="delete">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.bucket}>
                  <div className={styles.bucketTitle}>Someday</div>
                  {grouped.someday.length === 0 ? <div className={styles.empty}>（なし）</div> : null}
                  {grouped.someday.map((t) => (
                    <div key={t.id} className={styles.taskRow}>
                      <label className={styles.check}>
                        <input type="checkbox" checked={t.done} onChange={() => toggleDone(t.id)} />
                        <span className={t.done ? styles.done : ""}>{t.text}</span>
                      </label>

                      <div className={styles.taskActions}>
                        <select
                          className={styles.select}
                          value={t.bucket}
                          onChange={(e) => changeBucket(t.id, e.target.value as TaskItem["bucket"])}
                        >
                          <option value="inbox">Inbox</option>
                          <option value="today">Today</option>
                          <option value="week">This Week</option>
                          <option value="someday">Someday</option>
                        </select>
                        <button className={styles.iconBtn} onClick={() => removeTask(t.id)} aria-label="delete">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* プロンプト */}
          <section className={styles.card}>
            <div className={styles.cardInner}>
              <div className={styles.row} style={{ justifyContent: "space-between" }}>
                <h2 className={styles.h2} style={{ margin: 0 }}>
                  発行したプロンプト
                </h2>

                <button
                  className={styles.btn}
                  onClick={() => copyToClipboard(issuedPrompt, "プロンプトをコピーした")}
                  disabled={!issuedPrompt}
                >
                  コピー
                </button>
              </div>

              <p className={styles.hint}>他のAIにそのままコピペしてOK。</p>

              <textarea className={styles.textarea} value={issuedPrompt} readOnly placeholder="発行するとここに出るよ" />
            </div>
          </section>
        </div>

        {toast ? <div className={styles.toast}>{toast}</div> : null}
      </main>
    </>
  );
}
