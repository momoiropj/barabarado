"use client";

import Link from "next/link";
import styles from "./SiteHeader.module.css";


type Pill = { text: string };
type NavLink = { href: string; label: string };

type Props = {
  title: string;
  subtitle?: string;
  pills?: Pill[];
  navLinks?: NavLink[];
};

export default function SiteHeader({ title, subtitle, pills = [], navLinks = [] }: Props) {
  return (
    <header className={styles.header}>
      {(pills?.length ?? 0) > 0 && (
        <div className={styles.pills}>
          {pills.map((p, i) => (
            <span key={`${p.text}-${i}`} className={styles.pill}>
              {p.text}
            </span>
          ))}
        </div>
      )}

      <h1 className={styles.title}>{title}</h1>

      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

      {(navLinks?.length ?? 0) > 0 && (
        <nav className={styles.nav}>
          {navLinks.map((l) => (
            <Link key={l.href} className={styles.navBtn} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
