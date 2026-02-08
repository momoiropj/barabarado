"use client";

import Link from "next/link";
import styles from "./SiteHeader.module.css";

export type Pill = { text: string };
export type NavLink = { href: string; label: string };

export type SiteHeaderProps = {
  title: string;
  subtitle?: string;
  pills?: Pill[];
  navLinks?: NavLink[];
  backHref?: string;
  backLabel?: string;
};

export default function SiteHeader({
  title,
  subtitle,
  pills = [],
  navLinks = [],
  backHref,
  backLabel = "← Lists",
}: SiteHeaderProps) {
  return (
    <header className={styles.wrap}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <div className={styles.titleRow}>
            {backHref ? (
              <Link className={styles.backLink} href={backHref}>
                {backLabel}
              </Link>
            ) : null}
            <h1 className={styles.title}>{title}</h1>
          </div>

          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}

          {pills.length ? (
            <div className={styles.pills}>
              {pills.map((p, i) => (
                <span key={i} className={styles.pill}>
                  {p.text}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {navLinks.length ? (
          <nav className={styles.nav} aria-label="Site navigation">
            {navLinks.map((l) => (
              <Link key={l.href} className={styles.navLink} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
