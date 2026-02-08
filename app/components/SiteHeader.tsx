"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteHeader.module.css";

type NavLink = { href: string; label: string; emoji?: string };

const NAV: NavLink[] = [
  { href: "/lists", label: "Lists", emoji: "🧸" },
  { href: "/help", label: "Help", emoji: "🛟" },
  { href: "/concept", label: "Concept", emoji: "🧠" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/lists") return pathname === "/lists" || pathname.startsWith("/lists/");
    return pathname === href;
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/lists" className={styles.brand} aria-label="BarabaraDo home">
          <span className={styles.logo}>🧸</span>
          <span className={styles.brandText}>BarabaraDo</span>
          <span className={styles.brandTag}>ゲスト</span>
        </Link>

        <nav className={styles.nav} aria-label="Main navigation">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`${styles.navLink} ${isActive(n.href) ? styles.active : ""}`}
              aria-current={isActive(n.href) ? "page" : undefined}
            >
              <span className={styles.navEmoji}>{n.emoji ?? ""}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.right}>
          <span className={styles.pill}>分解 → 編集 → 発行</span>
        </div>
      </div>
    </header>
  );
}
