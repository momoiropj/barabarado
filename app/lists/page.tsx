"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
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

export default function Page() {
  const router = useRouter();

  const [lists, setLists] = useState<ListRow[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLists(loadGuestLists());
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const sorted = useMemo(() => {
    const copy = [...lists];
    copy.sort((a, b) => {
      const at = a.updatedAt || a.createdAt || "";
      const bt = b.updatedAt || b.createdAt || "";
      return bt.localeCompare(at);
    });
    return copy;
  }, [lists]);

  const createList = () => {
    setError(null);
    const title = newTitle.trim();
    if (!title) {
      setError("タイトルを入れてね（1行でOK）");
      return;
    }
    const now = new Date().toISOString();
    const row: ListRow = { id: uid(), title, createdAt: now, updatedAt: now };
    const next = [row, ...lists];
    setLists(next);
    saveGuestLists(next);
    setNewTitle("");
    setToast("リスト作った");
  };

  const openList = (id: string) => {
    router.push(`/lists/${id}`);
  };

  const deleteList = (id: string) => {
    const ok = window.confirm("このリストを削除する？（チェックリスト等も消える）");
    if (!ok) return;

    const next = lists.filter((x) => x.id !== id);
    setLists(next);
    saveGuestLists(next);

    try {
      localStorage.removeItem(`bbdo_guest_list_detail_v1_${id}`);
    } catch {
      // ignore
    }

    setToast("削除した");
  };

  return (
    <main className={styles.main}>
      <SiteHeader
        title="Lists"
        subtitle="1行で作って、分解して、チェックリスト化。最後にプロンプト発行で他AIへバトンパス。"
        pills={[{ text: "🧸 BarabaraDo（ゲスト）" }, { text: "🔒 この端末のブラウザに保存" }]}
        navLinks={[
          { href: "/help", label: "Help" },
          { href: "/concept", label: "Concept" },
        ]}
      />

      <div className={styles.container}>
        <section className={styles.card}>
          <div className={styles.cardInner}>
            <h2 className={styles.sectionTitle}>新しいリスト</h2>
            <p className={styles.sectionHint}>例：「確定申告を終わらせる」「新商品の撮影をやる」みたいに、まずは1行。</p>

            <div className={styles.row}>
              <input
                className={styles.input}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="やりたいことを1行で"
                onKeyDown={(e) => {
                  if (e.key === "Enter") createList();
                }}
              />
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={createList}>
                作る
              </button>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardInner}>
            <h2 className={styles.sectionTitle}>あなたのリスト</h2>
            <p className={styles.sectionHint}>クリックで詳細へ。削除は右のボタン。</p>

            {sorted.length === 0 ? (
              <p className={styles.sectionHint}>まだリストがない。上で1つ作ろう。</p>
            ) : (
              <div className={styles.grid}>
                {sorted.map((l) => (
                  <div key={l.id} className={styles.listCard}>
                    <div className={styles.listTitleRow}>
                      <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => openList(l.id)}>
                        開く
                      </button>
                      <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => deleteList(l.id)}>
                        削除
                      </button>
                    </div>

                    <div className={styles.listTitle}>{l.title}</div>
                    <div className={styles.listMeta}>
                      更新: {(l.updatedAt || l.createdAt || "").replace("T", " ").slice(0, 16)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {toast ? <div className={styles.toast}>{toast}</div> : null}
    </main>
  );
}
