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
  done: boolean;
};

type Bucket = {
  key: string;
  label: string;
  items: ChecklistItem[];
};

type StoredDetail = {
  draft: string;
  buckets: Bucket[];
  prompt: string; // ここは「最終コピペ用（Markdown）」を保存する
};

const GUEST_LISTS_KEY = "bbdo_guest_lists_v1";
const DETAIL_KEY = (id: string) => `bbdo_guest_list_detail_v1_${id}`;

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadGuestLists(): ListRow[] {
  if (typeof window === "undefined") return [];
  const parsed = safeParseJSON<ListRow[]>(localStorage.getItem(GUEST_LISTS_KEY));
  if (!parsed || !Array.isArray(parsed)) return [];
  return parsed
    .filter((x) => x && typeof x.id === "string" && typeof x.title === "string")
    .map((x) => ({
      id: x.id,
      title: x.title,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
    }));
}

function saveGuestLists(lists: ListRow[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_LISTS_KEY, JSON.stringify(lists));
}

function createEmptyBuckets(): Bucket[] {
  return [
    { key: "why", label: "なぜやる？（目的/気持ち）", items: [] },
    { key: "now", label: "現状確認（手元/条件/期限）", items: [] },
    { key: "prep", label: "準備（道具/情報/人）", items: [] },
    { key: "do", label: "実行（小さく進める）", items: [] },
    { key: "review", label: "確認/完了条件", items: [] },
  ];
}

function loadDetail(id: string): StoredDetail {
  if (typeof window === "undefined") return { draft: "", buckets: createEmptyBuckets(), prompt: "" };

  const parsed = safeParseJSON<StoredDetail>(localStorage.getItem(DETAIL_KEY(id)));
  if (!parsed) return { draft: "", buckets: createEmptyBuckets(), prompt: "" };

  return {
    draft: typeof parsed.draft === "string" ? parsed.draft : "",
    buckets: Array.isArray(parsed.buckets) ? (parsed.buckets as Bucket[]) : createEmptyBuckets(),
    prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
  };
}

function saveDetail(id: string, detail: StoredDetail) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DETAIL_KEY(id), JSON.stringify(detail));
}

function formatChecklistMarkdown(buckets: Bucket[]) {
  const lines: string[] = [];
  for (const b of buckets) {
    lines.push(`#### ${b.label}`);
    if (!b.items?.length) {
      lines.push(`- [ ] （未入力）`);
      lines.push("");
      continue;
    }
    for (const it of b.items) {
      lines.push(`- [${it.done ? "x" : " "}] ${it.title}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function buildIssuedPrompt(basePrompt: string, buckets: Bucket[]) {
  const baton = [
    "あなたはユーザーの伴走AI。",
    "ユーザーは BarabaraDo でToDoを分解し、今ここに来た。",
    "",
    "最初に短く受け取り宣言（例：「OK、BarabaraDoからバトンパス受け取ったよ！」）。",
    "次に、以下をやる：",
    "1) ユーザーの状況に合わせてチェックリストを微調整（不足追加・粒度調整・順番最適化）",
    "2) 今日やる最初の5分を提案（摩擦が小さい行動）",
    "3) 質問は最大2つ（ただし提案の後）",
    "4) 返信は日本語・口語・前向き。長文説教は禁止。",
  ].join("\n");

  const checklistBlock = formatChecklistMarkdown(buckets);
  const checklistSection = checklistBlock
    ? `\n\n### 以下は現時点でチェックリストになります。\n${checklistBlock}\n`
    : "";

  return `## Prompt\n${baton}\n\n---\n\n${basePrompt.trim()}\n${checklistSection}`.trim() + "\n";
}

export default function Page() {
  const router = useRouter();
  const params = useParams();

  const id = useMemo(() => {
    const raw = (params as any)?.id;
    return Array.isArray(raw) ? raw[0] : String(raw || "");
  }, [params]);

  const [title, setTitle] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [buckets, setBuckets] = useState<Bucket[]>(createEmptyBuckets());
  const [issuedPrompt, setIssuedPrompt] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const lists = loadGuestLists();
    const row = lists.find((x) => x.id === id);
    if (!row) {
      setError("リストが見つからない。/lists に戻って作り直してね。");
      return;
    }
    setTitle(row.title);
    document.title = `${row.title} | BarabaraDo`;

    const detail = loadDetail(id);
    setDraft(detail.draft);
    setBuckets(detail.buckets?.length ? detail.buckets : createEmptyBuckets());
    setIssuedPrompt(detail.prompt || "");
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const persist = (next: Partial<StoredDetail>) => {
    if (!id) return;
    const current = loadDetail(id);
    const merged: StoredDetail = {
      draft: next.draft ?? current.draft,
      buckets: next.buckets ?? current.buckets,
      prompt: next.prompt ?? current.prompt,
    };
    saveDetail(id, merged);

    // lists の updatedAt を更新
    const lists = loadGuestLists();
    const idx = lists.findIndex((x) => x.id === id);
    if (idx >= 0) {
      lists[idx] = { ...lists[idx], updatedAt: new Date().toISOString() };
      saveGuestLists(lists);
    }
  };

  const runBreakdown = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          todo: title,
          context: draft,
        }),
      });

      if (!res.ok) throw new Error("breakdown failed");
      const data = await res.json();
      const text = typeof data?.text === "string" ? data.text : "";
      if (!text.trim()) throw new Error("empty breakdown");
      setDraft(text);
      persist({ draft: text });
      setToast("分解した（文章）");
    } catch (e) {
      setError("分解に失敗。APIがまだなら一旦スキップでOK。");
    } finally {
      setBusy(false);
    }
  };

  const categorize = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          draft,
          buckets,
        }),
      });

      if (!res.ok) throw new Error("categorize failed");
      const data = await res.json();

      const nextBuckets: Bucket[] = Array.isArray(data?.buckets) ? data.buckets : null;
      if (!nextBuckets) throw new Error("bad response");

      setBuckets(nextBuckets);
      persist({ buckets: nextBuckets });
      setToast("チェックリスト更新した");
    } catch (e) {
      setError("カテゴリ分けに失敗。/api/categorize の戻り値を確認してね。");
    } finally {
      setBusy(false);
    }
  };

  const toggleItem = (bucketKey: string, itemId: string) => {
    const next = buckets.map((b) => {
      if (b.key !== bucketKey) return b;
      return {
        ...b,
        items: b.items.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it)),
      };
    });
    setBuckets(next);
    persist({ buckets: next });
  };

  const addItem = (bucketKey: string) => {
    const text = window.prompt("追加するチェック項目（1行）");
    if (!text) return;

    const next = buckets.map((b) => {
      if (b.key !== bucketKey) return b;
      return {
        ...b,
        items: [...b.items, { id: uid(), title: text.trim(), done: false }],
      };
    });
    setBuckets(next);
    persist({ buckets: next });
  };

  const deleteItem = (bucketKey: string, itemId: string) => {
    const next = buckets.map((b) => {
      if (b.key !== bucketKey) return b;
      return {
        ...b,
        items: b.items.filter((it) => it.id !== itemId),
      };
    });
    setBuckets(next);
    persist({ buckets: next });
  };

  const issuePrompt = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          buckets,
        }),
      });

      if (!res.ok) throw new Error("prompt failed");
      const data = await res.json();
      const basePrompt = typeof data?.prompt === "string" ? data.prompt : "";
      if (!basePrompt.trim()) throw new Error("empty prompt");

      const finalPrompt = buildIssuedPrompt(basePrompt, buckets);
      setIssuedPrompt(finalPrompt);
      persist({ prompt: finalPrompt });

      try {
        await navigator.clipboard.writeText(finalPrompt);
        setToast("プロンプト発行＆コピーした");
      } catch {
        setToast("プロンプト発行した（コピーは手動）");
      }
    } catch (e) {
      setError("プロンプト発行に失敗。/api/prompt を確認してね。");
    } finally {
      setBusy(false);
    }
  };

  const copyChecklist = async () => {
    const text = formatChecklistMarkdown(buckets) + "\n";
    try {
      await navigator.clipboard.writeText(text);
      setToast("チェックリストコピーした");
    } catch {
      setToast("コピー失敗（手動で）");
    }
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(issuedPrompt || "");
      setToast("プロンプトコピーした");
    } catch {
      setToast("コピー失敗（手動で）");
    }
  };

  const deleteThisList = () => {
    const ok = window.confirm("このリストを削除する？（戻せない）");
    if (!ok) return;

    const lists = loadGuestLists().filter((x) => x.id !== id);
    saveGuestLists(lists);
    try {
      localStorage.removeItem(DETAIL_KEY(id));
    } catch {
      // ignore
    }
    router.push("/lists");
  };

  return (
    <main className={styles.main}>
      <SiteHeader
        title={title || "List"}
        subtitle="下書き → 分解 → チェックリスト化 → プロンプト発行（他AIへバトンパス）"
        pills={[{ text: "🧸 BarabaraDo（ゲスト）" }, { text: "🧠 分解 → 編集 → 発行" }]}
        backHref="/lists"
        backLabel="← Lists"
        navLinks={[
          { href: "/help", label: "Help" },
          { href: "/concept", label: "Concept" },
        ]}
      />

      <div className={styles.container}>
        <section className={styles.card}>
          <div className={styles.cardInner}>
            <div className={styles.sectionTopRow}>
              <h2 className={styles.sectionTitle}>下書き（そのまま書く）</h2>
              <div className={styles.row}>
                <button className={`${styles.btn} ${styles.btnGhost}`} onClick={runBreakdown} disabled={busy}>
                  AIで分解（文章）
                </button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={categorize} disabled={busy}>
                  チェックリスト更新
                </button>
              </div>
            </div>

            <p className={styles.sectionHint}>
              ここは雑でOK。今の不安、状況、期限、関係者、わからないこと、全部投げていい。
            </p>

            <textarea
              className={styles.textarea}
              rows={8}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                persist({ draft: e.target.value });
              }}
              placeholder="例：何から手をつければいいか分からない。期限は◯日。必要書類が不明。"
            />

            {error ? <p className={styles.error}>{error}</p> : null}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardInner}>
            <div className={styles.sectionTopRow}>
              <h2 className={styles.sectionTitle}>チェックリスト</h2>
              <div className={styles.row}>
                <button className={`${styles.btn} ${styles.btnGhost}`} onClick={copyChecklist}>
                  チェックリストをコピー
                </button>
                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={deleteThisList}>
                  このリストを削除
                </button>
              </div>
            </div>

            <div className={styles.bucketGrid}>
              {buckets.map((b) => (
                <div key={b.key} className={styles.bucketCard}>
                  <div className={styles.bucketTop}>
                    <h3 className={styles.bucketTitle}>{b.label}</h3>
                    <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => addItem(b.key)}>
                      ＋追加
                    </button>
                  </div>

                  <div className={styles.items}>
                    {b.items?.length ? (
                      b.items.map((it) => (
                        <div key={it.id} className={styles.itemRow}>
                          <label className={styles.itemLeft}>
                            <input
                              type="checkbox"
                              checked={it.done}
                              onChange={() => toggleItem(b.key, it.id)}
                            />
                            <span className={it.done ? styles.itemDone : styles.itemText}>{it.title}</span>
                          </label>
                          <button className={`${styles.btn} ${styles.btnIcon}`} onClick={() => deleteItem(b.key, it.id)}>
                            ×
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className={styles.muted}>まだ空。＋追加か「チェックリスト更新」で埋めよう。</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardInner}>
            <div className={styles.sectionTopRow}>
              <h2 className={styles.sectionTitle}>プロンプト発行（Markdown / コピペ用）</h2>
              <div className={styles.row}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={issuePrompt} disabled={busy}>
                  発行してコピー
                </button>
                <button className={`${styles.btn} ${styles.btnGhost}`} onClick={copyPrompt} disabled={!issuedPrompt}>
                  プロンプトだけコピー
                </button>
              </div>
            </div>

            <p className={styles.sectionHint}>
              発行すると「BarabaraDoからバトンパス」指示と、今のチェックリストが自動で付く。
            </p>

            <textarea
              className={styles.textarea}
              rows={10}
              value={issuedPrompt}
              onChange={(e) => {
                setIssuedPrompt(e.target.value);
                persist({ prompt: e.target.value });
              }}
              placeholder="ここに最終プロンプトが出る。発行ボタンを押してね。"
            />
          </div>
        </section>
      </div>

      {toast ? <div className={styles.toast}>{toast}</div> : null}
    </main>
  );
}
