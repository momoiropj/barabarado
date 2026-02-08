import Link from "next/link";
import styles from "./SiteHeader.module.css";

export type Pill = { text: string };
export type NavLink = { href: string; label: string };

export type SiteHeaderProps = {
  title?: string;
  subtitle?: string;
  pills?: Pill[];
  navLinks?: NavLink[];

  // Lists/[id] みたいに「戻る」を出したいとき用（任意）
  backHref?: string;
  backLabel?: string;
};

const DEFAULT_PILLS: Pill[] = [
  { text: "🧸 ゲストモード" },
  { text: "🔒 この端末のブラウザに保存します" },
];

const DEFAULT_NAV: NavLink[] = [
  { href: "/concept", label: "Concept" },
  { href: "/help", label: "Help" },
];

function normalizePills(pills?: Pill[]): Pill[] {
  // 何も渡されなければデフォルト
  if (!pills || pills.length === 0) return DEFAULT_PILLS;

  // 既存の文言が残ってても自動で置換（“直し忘れ”耐性）
  return pills.map((p) => {
    if (p.text === "🧸 BarabaraDo（ゲスト）") return { text: "🧸 ゲストモード" };
    if (p.text === "🔒 データはこの端末のブラウザに保存") return { text: "🔒 この端末のブラウザに保存します" };
    return p;
  });
}

function normalizeNavLinks(navLinks?: NavLink[]): NavLink[] {
  const list = (navLinks && navLinks.length > 0 ? navLinks : DEFAULT_NAV).slice();

  // “Concept と Help の位置入れ替え”を強制（渡された配列が逆でも直す）
  const rank = (href: string) => {
    if (href === "/concept") return 0;
    if (href === "/help") return 1;
    return 99;
  };

  return list.sort((a, b) => rank(a.href) - rank(b.href));
}

export default function SiteHeader(props: SiteHeaderProps) {
  const title = props.title ?? "BarabaraDo";
  const subtitle = props.subtitle ?? "分解 → 編集 → 発行（他AIへバトンパス）";
  const pills = normalizePills(props.pills);
  const navLinks = normalizeNavLinks(props.navLinks);

  return (
    <header className={styles.headerWrap}>
      <div className={styles.inner}>
        <div className={styles.topRow}>
          <div className={styles.left}>
            {props.backHref ? (
              <Link className={styles.backLink} href={props.backHref}>
                {props.backLabel ?? "← Back"}
              </Link>
            ) : (
              <span className={styles.brandPill}>🧸 BarabaraDo</span>
            )}
          </div>

          <nav className={styles.nav}>
            {navLinks.map((l) => (
              <Link key={l.href} className={styles.navLink} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className={styles.mid}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        <div className={styles.pills}>
          {pills.map((p, i) => (
            <span key={`${p.text}_${i}`} className={styles.pill}>
              {p.text}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
