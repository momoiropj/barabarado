"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

type ListRow = {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
};

const GUEST_LISTS_KEY = "bbdo_guest_lists_v1";
const DETAIL_KEY_PREFIX = "bbdo_guest_list_detail_v1:";

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

function removeDetail(listId: string) {
  try {
    localStorage.removeItem(`${DETAIL_KEY_PREFIX}${listId}`);
  } catch {}
}

export default function Page() {
  const router = useRouter();

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1400);
  };

  const [lists, setLists] = useState<ListRow[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLists(loadGuestLists());
  }, []);

  const sorted = useMemo(() => {
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

  const openList = (id: string) => router.push(`/lists/${id}`);

  const deleteList = (id: string) => {
    const ok = window.confirm("このリストを削除する？（この端末から消える）");
    if (!ok) return;

    const next = lists.filter((l) => l.id !== id);
    setLists(next);
    saveGuestLists(next);
    removeDetail(id);
    showToast("削除した");
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>Lists</h1>
            <p className={styles.subtitle}>
              リストを作る → 分解する → チェックリスト化 → プロンプト発行（他AIへバトンパス）
            </p>
          </div>

          <div className={styles.headerRight}>
            {/* CSSが死んでも読めるように区切り文字を入れてる */}
            <div className={styles.badges}>
              <span className={styles.badge}>🧸 ゲストモード</span>
              <span className={styles.badge}>🔒 この端末のブラウザに保存</span>
            </div>

            <nav className={styles.nav}>
              <Link className={styles.navLink} href="/help">
                Help
              </Link>
              <span className={styles.navSep}>·</span>
              <Link className={styles.navLink} href="/concept">
                Concept
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className={styles.container}>
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>新しいリスト</h2>
          <p className={styles.sectionHint}>まずは1行でOK。あとで分解して、チェックリスト化する。</p>

          <div className={styles.row}>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タイトルを入れてね。 例）確定申告 / 部屋の片付け / 引っ越し準備"
              onKeyDown={(e) => {
                if (e.key === "Enter") createList();
              }}
            />
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={createList} type="button">
              ＋作成
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>一覧</h2>
          <p className={styles.sectionHint}>開く／削除ができる。</p>

          {sorted.length === 0 ? (
            <p className={styles.sectionHint} style={{ marginTop: 10 }}>
              （まだリストがないよ。上で作ってね）
            </p>
          ) : (
            <div className={styles.grid}>
              {sorted.map((l) => (
                <div key={l.id} className={styles.listCard}>
                  <div className={styles.listCardTop}>
                    <h3 className={styles.listTitle}>{l.title}</h3>
                    <button
                      className={`${styles.btn} ${styles.btnDanger}`}
                      onClick={() => deleteList(l.id)}
                      type="button"
                    >
                      削除
                    </button>
                  </div>

                  <div className={styles.row} style={{ marginTop: 10 }}>
                    <button
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={() => openList(l.id)}
                      type="button"
                    >
                      開く
                    </button>
                  </div>

                  <p className={styles.meta}>id: {l.id}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </main>
  );
}
