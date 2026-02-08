import Link from "next/link";
import styles from "./SiteHeader.module.css";

type Pill = { text: string };
type NavLink = { href: string; label: string };

export type SiteHeaderProps = {
  title: string;
  subtitle?: string;
  pills?: Pill[];
  navLinks?: NavLink[];
};

export default function SiteHeader({ title, subtitle, pills = [], navLinks = [] }: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.topRow}>
          <Link href="/lists" className={styles.brand}>
            🧸 BarabaraDo
          </Link>

          {navLinks.length > 0 && (
            <nav className={styles.nav} aria-label="Primary">
              {navLinks.map((n) => (
                <Link key={n.href} href={n.href} className={styles.navLink}>
                  {n.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>

          {pills.length > 0 && (
            <div className={styles.pills}>
              {pills.map((p, i) => (
                <span key={`${p.text}_${i}`} className={styles.pill}>
                  {p.text}
                </span>
              ))}
            </div>
          )}
        </div>

        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
    </header>
  );
}
