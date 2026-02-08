import Link from "next/link";
import styles from "./SiteHeader.module.css";

type Pill = { text: string };
type NavLink = { href: string; label: string };

export type SiteHeaderProps = {
  title?: string;
  subtitle?: string;
  pills?: Pill[];
  navLinks?: NavLink[];
};

const DEFAULT_PILLS: Pill[] = [{ text: "🧸 BarabaraDo（ゲスト）" }, { text: "🧠 分解 → 編集 → 発行" }];

const DEFAULT_NAVLINKS: NavLink[] = [
  { href: "/lists", label: "Lists" },
  { href: "/concept", label: "Concept" },
  { href: "/help", label: "Help" },
];

export default function SiteHeader({
  title = "BarabaraDo",
  subtitle = "下書き→分類→編集→プロンプト発行。発行したプロンプトを他AIにコピペして伴走を続ける。",
  pills = DEFAULT_PILLS,
  navLinks = DEFAULT_NAVLINKS,
}: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <Link href="/lists" className={styles.brand}>
            {title}
          </Link>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}

          {pills?.length ? (
            <div className={styles.pills}>
              {pills.map((p, i) => (
                <span key={`${p.text}_${i}`} className={styles.pill}>
                  {p.text}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {navLinks?.length ? (
          <nav className={styles.nav}>
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className={styles.navLink}>
                {l.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
