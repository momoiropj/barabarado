import SiteHeader from "@/app/components/SiteHeader";
import styles from "./page.module.css";

export const metadata = {
  title: "Concept | BarabaraDo",
};

export default function Page() {
  return (
    <>
      <SiteHeader
        title="Concept"
        subtitle="BarabaraDoは「分解 → 編集 → 発行」で、行動を始めるまでの摩擦を消すためのツール。"
        pills={[{ text: "🧸 BarabaraDo（ゲスト）" }, { text: "🧠 分解 → 編集 → 発行" }]}
        navLinks={[
          { href: "/lists", label: "Lists" },
          { href: "/concept", label: "Concept" },
          { href: "/help", label: "Help" },
        ]}
      />

      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Concept</h1>
          <p className={styles.lead}>
            やる気があっても、タスクがデカすぎたり曖昧だったりすると人類は固まる。BarabaraDoは、その「固まり」をほどくための仕組み。
          </p>

          <section className={styles.card}>
            <h2 className={styles.h2}>BarabaraDoがやること</h2>
            <p className={styles.p}>
              入力したToDoを、まず「気持ち / 現状 / なぜ（Why）」で足場を作ってから、完了条件とチェックリストに落とす。
              その上で「他のAIに渡して伴走を続けるためのプロンプト」を発行する。
            </p>
          </section>

          <section className={styles.card}>
            <h2 className={styles.h2}>プロンプト発行の思想</h2>
            <ul className={styles.ul}>
              <li>発行されたプロンプトはそのままコピペでAIに渡せる（Markdown）</li>
              <li>チェックリスト付きの場合は「以下は現時点でチェックリストになります」を入れて文脈を渡す</li>
              <li>受け取ったAIが「バトンパスされた」前提で、次の一手を提案しやすい形にする</li>
            </ul>

            <div className={styles.note}>
              目的：BarabaraDoが作るのは「完璧な計画」じゃなくて、
              <b>“次の5分を始められる形”</b>。
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
