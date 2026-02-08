"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

type ListRow = {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
};

const GUEST_LISTS_KEY = "bbdo_guest_lists_v1";

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
  try {
    localStorage.setItem(GUEST_LISTS_KEY, JSON.stringify(lists));
  } catch {}
}

export default function Page() {
  const router = useRouter();

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  };

  const [lists, setLists] = useState<ListRow[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLists(loadGuestLists());
  }, []);

  const sorted = useMemo(() => {
    // updatedAt / createdAt があれば新しい順、なければタイトル順
    return [...lists].sort((a, b) => {
      const at = a.updatedAt || a.createdAt || "";
      const bt = b.updatedAt || b.createdAt || "";
      if (at && bt) return bt.localeCompare(at);
      return a.title.localeCompare(b.title);
    });
  }, [lists]);

  const createList = () => {
    setError("");
    const t = title.trim();
    if (!t) {
      setError("タイトルを入れてね");
      return;
    }

    const now = new Date().toISOString();
    const row: ListRow = { id: uid(), title: t, createdAt: now, updatedAt: now };
    const next = [row, ...lists];
    setLists(next);
    saveGuestLists(next);
    setTitle("");
    showToast("リスト作った");
    router.push(`/lists/${row.id}`);
  };

  const openList = (id: string) => {
    router.push(`/lists/${id}`);
  };

  const deleteList = (id: string) => {
    const ok = window.confirm("このリストを削除する？（この端末から消える）");
    if (!ok) return;

    const next = lists.filter((l) => l.id !== id);
    setLists(next);
    saveGuestLists(next);
    showToast("削除した");
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.topRow}>
          <span className={styles.pill}>🧸 BarabaraDo（ゲスト）</span>
          <span className={styles.pill}>✨ かわいく整形中</span>
        </div>

        <h1 className={styles.pageTitle}>Lists</h1>

        <div className={styles.subtitleRow}>
          <span className={styles.pill}>🔒 データはこの端末のブラウザに保存</span>
          <span className={styles.pill}>🧠 分解 → 編集 → 発行</span>
        </div>

        <section className={styles.card}>
          <div className={styles.cardInner}>
            <h2 className={styles.sectionTitle}>新しいリスト</h2>
            <p className={styles.sectionHint}>まずは1行でOK。あとで分解して、チェックリスト化する。</p>

            <div className={styles.row} style={{ marginTop: 10 }}>
              <input
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例）確定申告の準備 / クローズドリリース準備 / 梱包改善"
                onKeyDown={(e) => {
                  if (e.key === "Enter") createList();
                }}
              />

              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={createList}>
                ＋作成
              </button>
            </div>

            {error && <p className={styles.error}>{error}</p>}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardInner}>
            <h2 className={styles.sectionTitle}>一覧</h2>
            <p className={styles.sectionHint}>タップで開く。不要なら削除。</p>

            {sorted.length === 0 ? (
              <p className={styles.sectionHint} style={{ marginTop: 10 }}>
                （まだリストがないよ。上で作ってね）
              </p>
            ) : (
              <div className={styles.grid}>
                {sorted.map((l) => (
                  <div key={l.id} className={styles.listCard}>
                    <div className={styles.listTitleRow}>
                      <h3 className={styles.listTitle}>{l.title}</h3>
                      <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => deleteList(l.id)}>
                        削除
                      </button>
                    </div>

                    <div className={styles.row} style={{ marginTop: 10 }}>
                      <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => openList(l.id)}>
                        開く
                      </button>
                    </div>

                    <p className={styles.listMeta}>id: {l.id}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </main>
  );
}
