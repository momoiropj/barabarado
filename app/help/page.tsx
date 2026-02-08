import Link from "next/link";
import styles from "./page.module.css";
import SiteHeader from "@/app/components/SiteHeader";


export const metadata = {
  title: "Help | BarabaraDo",
};

export default function HelpPage() {
  return (
    <main className={styles.main}>
<SiteHeader
  title="Help"
  subtitle="使い方・注意点・よくある質問まとめ"
  pills={[{ text: "📘 Help" }, { text: "🧸 BarabaraDo" }]}
  navLinks={[
    { href: "/lists", label: "← Lists" },
    { href: "/concept", label: "💡 Concept" },
  ]}
/>

      <div className={styles.container}>
        <div className={styles.topRow}>
          <Link className={styles.backBtn} href="/lists">
            ← Listsに戻る
          </Link>

          <div className={styles.pills}>
            <span className={styles.pill}>🧸 BarabaraDo</span>
            <span className={styles.pill}>📘 Help</span>
          </div>
        </div>

        <header className={styles.header}>
          <h1 className={styles.h1}>ヘルプ：使い方</h1>
          <p className={styles.lead}>
            BarabaraDoは「分解 → 編集 → 発行（AIへバトンパス）」で、迷いを潰して前に進むツール。
            ここに書いてある通りにやれば、とりあえず前へ進む。
          </p>

          <div className={styles.navRow}>
            <Link className={styles.btn} href="/concept">
              コンセプトを見る
            </Link>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/lists">
              Listsへ行く
            </Link>
          </div>
        </header>

        <section className={styles.card}>
          <div className={styles.cardInner}>
            <h2 className={styles.h2}>基本の流れ（3ステップ）</h2>

            <div className={styles.grid}>
              <div className={styles.step}>
                <div className={styles.stepHead}>
                  <span className={styles.badge}>STEP 1</span>
                  <h3 className={styles.h3}>まず自由に書く（下書き）</h3>
                </div>
                <p className={styles.p}>
                  思いついた順でOK。箇条書き推奨。汚くていい、脳内ダンプが正義。
                </p>
                <ul className={styles.ul}>
                  <li>例：気持ち、現状、制約、やること候補</li>
                  <li>「なぜやるのか」が書けると分解が強くなる</li>
                </ul>
              </div>

              <div className={styles.step}>
                <div className={styles.stepHead}>
                  <span className={styles.badge}>STEP 2</span>
                  <h3 className={styles.h3}>AIで5カテゴリに分ける（取り込み）</h3>
                </div>
                <p className={styles.p}>
                  下書きをAIに整理させて、チェックリストの材料にする。
                </p>
                <ul className={styles.ul}>
                  <li>分類後も手で追加・削除・チェックできる</li>
                  <li>分類を押しても消えない（上書き破壊じゃなく取り込み）</li>
                </ul>
              </div>

              <div className={styles.step}>
                <div className={styles.stepHead}>
                  <span className={styles.badge}>STEP 3</span>
                  <h3 className={styles.h3}>プロンプト発行 → 自分のAIへ貼る</h3>
                </div>
                <p className={styles.p}>
                  最後に“自走できるプロンプト”を発行して、あなたの使うAIにそのままコピペ。
                  AIが「バトン受け取ったよ」モードで伴走してくれる。
                </p>
                <ul className={styles.ul}>
                  <li>プロンプトはMarkdown形式</li>
                  <li>チェックリストが付く場合は「以下は現時点のチェックリスト」文言が入る</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardInner}>
            <h2 className={styles.h2}>発行されたプロンプトをAIに渡すと何が起きる？</h2>
            <p className={styles.p}>
              あなたがプロンプトを貼った先のAIは、BarabaraDoから渡された情報（目的・状況・チェックリスト）を前提にして、
              こういう動きをするのが理想：
            </p>

            <div className={styles.kpiRow}>
              <div className={styles.kpi}>
                <div className={styles.kpiTitle}>🤝 バトンパス</div>
                <div className={styles.kpiText}>「OK、BarabaraDoから受け取った。ここから私がサポートする」</div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiTitle}>🧩 カスタマイズ</div>
                <div className={styles.kpiText}>あなたの制約（期限/予算/体力/状況）に合わせて調整</div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiTitle}>🚀 次の一歩</div>
                <div className={styles.kpiText}>「いまはこれから行こう」って提案して迷いを減らす</div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardInner}>
            <h2 className={styles.h2}>よくある詰まり & 回避</h2>

            <div className={styles.faq}>
              <div className={styles.faqItem}>
                <div className={styles.faqQ}>Q. 下書きが書けない</div>
                <div className={styles.faqA}>
                  A. 1行でいい。「やりたくない」「怖い」「面倒」でもOK。それが“分解の燃料”。
                </div>
              </div>

              <div className={styles.faqItem}>
                <div className={styles.faqQ}>Q. 分解が長すぎる</div>
                <div className={styles.faqA}>
                  A. “今日やる15分×3つ”に落とせば勝ち。完璧より前進。
                </div>
              </div>

              <div className={styles.faqItem}>
                <div className={styles.faqQ}>Q. 途中で投げたくなる</div>
                <div className={styles.faqA}>
                  A. それ普通。チェックリストの最初に「5分だけ」を作って、脳を騙す。
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardInner}>
            <h2 className={styles.h2}>ゲストモードの注意</h2>
            <ul className={styles.ul}>
              <li>データはこの端末のブラウザ（localStorage）に保存される</li>
              <li>別端末・別ブラウザでは引き継がれない</li>
              <li>ブラウザのデータ削除で消えることがある</li>
            </ul>

            <div className={styles.navRow} style={{ marginTop: 12 }}>
              <Link className={styles.btn} href="/concept">
                コンセプト
              </Link>
              <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/lists">
                Listsに戻る
              </Link>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          <span className={styles.mini}>© BarabaraDo</span>
        </footer>
      </div>
    </main>
  );
}
