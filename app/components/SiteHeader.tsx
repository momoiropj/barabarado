"use client";

import React from "react";
import Link from "next/link";
import styles from "./SiteHeader.module.css";

type Pill = { text: string };
type NavLink = { href: string; label: string };

export type SiteHeaderProps = {
  /** 省略OK（省略時は BarabaraDo） */
  title?: string;
  /** 省略OK */
  subtitle?: string;

  /** 省略OK */
  pills?: Pill[];

  /** 省略OK（省略時は Lists / Help / Concept を出す） */
  navLinks?: NavLink[];

  /** 省略OK（指定したら「戻る」リンクを左に出す） */
  backHref?: string;
  /** 省略OK（backHrefがある時だけ使われる） */
  backLabel?: string;

  /** 右側に何かボタン置きたい時用 */
  rightSlot?: React.ReactNode;

  /** さらに薄くしたい/余白調整したい時のフラグ（今は未使用でもOK） */
  compact?: boolean;
};

const DEFAULT_NAV: NavLink[] = [
  { href: "/lists", label: "Lists" },
  { href: "/help", label: "Help" },
  { href: "/concept", label: "Concept" },
];

export default function SiteHeader(props: SiteHeaderProps) {
  const {
    title = "BarabaraDo",
    subtitle,
    pills = [{ text: "🧸 BarabaraDo（ゲスト）" }, { text: "🧠 分解 → 編集 → 発行" }],
    navLinks = DEFAULT_NAV,
    backHref,
    backLabel = "← Back",
    rightSlot,
  } = props;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* 上段：左（戻る/タイトル） 右（ナビ/スロット） */}
        <div className={styles.topRow}>
          <div className={styles.left}>
            {backHref ? (
              <Link href={backHref} className={styles.backLink}>
                {backLabel}
              </Link>
            ) : (
              <span className={styles.backPlaceholder} />
            )}

            <div className={styles.brandBlock}>
              <div className={styles.title}>{title}</div>
              {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
            </div>
          </div>

          <div className={styles.right}>
            <nav className={styles.nav}>
              {navLinks.map((l) => (
                <Link key={l.href} href={l.href} className={styles.navLink}>
                  {l.label}
                </Link>
              ))}
            </nav>
            {rightSlot ? <div className={styles.rightSlot}>{rightSlot}</div> : null}
          </div>
        </div>

        {/* 下段：ピル */}
        {pills && pills.length > 0 ? (
          <div className={styles.pills}>
            {pills.map((p, i) => (
              <span key={`${p.text}_${i}`} className={styles.pill}>
                {p.text}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
