"use client";

import Link from "next/link";
import styles from "./SiteHeader.module.css";

export type Pill = { text: string };
export type NavLink = { href: string; label: string };

export type SiteHeaderProps = {
  title?: string;
  subtitle?: string;

  /** 右上に小さく出す2行くらいのステータス表示 */
  rightTopLines?: string[];

  /** 右側ナビ（Concept/Helpなど） */
  navLinks?: NavLink[];

  /** 戻るリンク（/lists/[id] で使う） */
  backHref?: string;
  backLabel?: string;
};

export default function SiteHeader({
  title,
  subtitle,
  rightTopLines,
  navLinks,
  backHref,
  backLabel,
}: SiteHeaderProps) {
  const lines =
    rightTopLines && rightTopLines.length > 0
      ? rightTopLines
      : ["🧸 ゲストモード", "🔒 この端末のブラウザに保存します"];

  const nav =
    navLinks && navLinks.length > 0
      ? navLinks
      : [
          // 「ヘルプとコンセプトの位置を入れ替え」＝ Concept → Help の順に固定
          { href: "/concept", label: "Concept" },
          { href: "/help", label: "Help" },
        ];

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.left}>
          {backHref ? (
            <Link className={styles.backLink} href={backHref}>
              {backLabel ?? "← Back"}
            </Link>
          ) : (
            <Link className={styles.brand} href="/lists">
              BarabaraDo
            </Link>
          )}
        </div>

        <div className={styles.center}>
          {title ? <h1 className={styles.title}>{title}</h1> : <div className={styles.titlePlaceholder} />}
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>

        <div className={styles.right}>
          <div className={styles.status}>
            {lines.slice(0, 3).map((t, i) => (
              <div key={i} className={styles.statusLine}>
                {t}
              </div>
            ))}
          </div>

          <nav className={styles.nav}>
            {nav.map((l) => (
              <Link key={l.href} className={styles.navLink} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
