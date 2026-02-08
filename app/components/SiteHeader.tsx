"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteHeader.module.css";

export type Pill = { text: string };
export type NavLink = { href: string; label: string };

export type SiteHeaderProps = {
  /** ページ見出し（省略可。省略時は "BarabaraDo"） */
  title?: string;
  subtitle?: string;

  /** 右上に出すピル（省略時はデフォルト2つ） */
  pills?: Pill[];

  /** 右側ナビ（省略時は Lists → Concept → Help） */
  navLinks?: NavLink[];

  /** 戻るリンク（[id]ページで使う想定） */
  backHref?: string;
  backLabel?: string;

  /** 左上ブランド（省略時は /lists, "BarabaraDo"） */
  brandHref?: string;
  brandLabel?: string;
};

export default function SiteHeader(props: SiteHeaderProps) {
  const pathname = usePathname();

  const {
    title = "BarabaraDo",
    subtitle,
    brandHref = "/lists",
    brandLabel = "BarabaraDo",
    backHref,
    backLabel = "← Back",
  } = props;

  // 👇 ここが「右上に移動したい」やつ。デフォルトも用意しとく
  const pills: Pill[] =
    props.pills ?? [
      { text: "🧸 ゲストモード" },
      { text: "🔒 この端末のブラウザに保存します" },
    ];

  // 👇 Help と Concept の並び替え：Lists → Concept → Help をデフォルトに
  const navLinks: NavLink[] =
    props.navLinks ?? [
      { href: "/lists", label: "Lists" },
      { href: "/concept", label: "Concept" },
      { href: "/help", label: "Help" },
    ];

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.topRow}>
          <Link href={brandHref} className={styles.brand}>
            {brandLabel}
          </Link>

          <div className={styles.rightRow}>
            <nav className={styles.nav}>
              {navLinks.map((l) => {
                const active =
                  pathname === l.href || (l.href !== "/" && pathname?.startsWith(l.href));
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>

            <div className={styles.pills}>
              {pills.map((p, idx) => (
                <span key={`${p.text}-${idx}`} className={styles.pill}>
                  {p.text}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.titleRow}>
          {backHref ? (
            <Link href={backHref} className={styles.backLink}>
              {backLabel}
            </Link>
          ) : null}

          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
        </div>
      </div>
    </header>
  );
}
