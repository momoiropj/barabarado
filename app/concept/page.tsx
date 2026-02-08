import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import SiteHeader from "@/app/components/SiteHeader";


export const metadata: Metadata = {
  title: "Concept | BarabaraDo",
};

export default function ConceptPage() {
  return (
    <main className={styles.main}>
<SiteHeader
  title="Concept"
  subtitle="分解 → 編集 → 発行 → 外部AIへバトンパス"
  pills={[{ text: "💡 Concept" }, { text: "🧸 BarabaraDo" }]}
  navLinks={[
    { href: "/lists", label: "← Lists" },
    { href: "/help", label: "📘 Help" },
  ]}
/>

      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.pills}>
            <span className={styles.pill}>🧸 BarabaraDo</span>
            <span className={styles.pill}>💡 Concept</span>
          </div>

          <h1 className={styles.title}>BarabaraDoのコンセプト</h1>
          <p className={styles.subtitle}>
            “やること” が大きすぎて止まる人のために。<br />
            分解して、整えて、外部AIへバトンパスして、今日から動ける状態にする。
          </p>

          <nav className={styles.nav}>
            <Link className={styles.navBtn} href="/lists">
              ← Lists
            </Link>
            <Link className={styles.navBtn} href="/help">
              📘 Help
            </Link>
          </nav>
        </header>

        <section className={styles.card}>
          <h2 className={styles.h2}>BarabaraDoがやること</h2>
          <div className={styles.grid2}>
            <div className={styles.feature}>
              <div className={styles.featureTitle}>① 書き散らかしOKの下書き</div>
              <p className={styles.featureText}>
                いきなり綺麗に書かなくていい。思いつきを投げて、後で整える前提で設計する。
              </p>
            </div>

            <div className={styles.feature}>
              <div className={styles.featureTitle}>② 5カテゴリに分類して、編集できる形へ</div>
              <p className={styles.featureText}>
                “気持ち/理由・現状/制約・予算/時間・手順・メモ” に分ける。分類後も手で足せる、消せる、直せる。
              </p>
            </div>

            <div className={styles.feature}>
              <div className={styles.featureTitle}>③ 最終プロンプトを発行（コピペ前提）</div>
              <p className={styles.featureText}>
                ユーザーが自分のAIに貼るだけで、AIが「OK、バトン受け取った！」から走り出せる状態にする。
              </p>
            </div>

            <div className={styles.feature}>
              <div className={styles.featureTitle}>④ “次の15分” を作る</div>
              <p className={styles.featureText}>
                抽象論で慰めない。最初の5分〜15分で終わるアクションを提示して、止まりを解除する。
              </p>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.h2}>分解の基本思想（BarabaraDoの癖）</h2>
          <ul className={styles.ul}>
            <li>
              <b>不明点があっても止まらない</b>：仮定を置いて先に完成版を出す（質問は後）。
            </li>
            <li>
              <b>完了条件を先に決める</b>：YES/NOで判定できるチェックにする。
            </li>
            <li>
              <b>小タスクは10〜30分単位</b>：「調べる」じゃなく「何をどこでどうする」まで書く。
            </li>
            <li>
              <b>心理→設計→実行</b>：気持ち/理由（Why）→完了定義（What）→実行手順（How）。
            </li>
          </ul>

          <div className={styles.callout}>
            <div className={styles.calloutTitle}>狙い</div>
            <div className={styles.calloutText}>
              BarabaraDoは “正しい計画” を作るアプリじゃなくて、<b>「今日の一歩」を発火させる装置</b>。
              綺麗さより、着火性。
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.h2}>バトンパス（外部AIに貼った瞬間に起きてほしいこと）</h2>
          <ol className={styles.ol}>
            <li>
              AIがまず受領宣言：「OK、BarabaraDoからバトン受け取った！ここから私がサポートする」
            </li>
            <li>チェックリストをユーザーに合わせて微調整（削る/足す/順番変える）</li>
            <li>今日の最初の15分を提案：「まずこれやろう」</li>
          </ol>

          <div className={styles.noteBox}>
            <div className={styles.noteTitle}>ポイント</div>
            <div className={styles.noteText}>
              “発行プロンプト” は、外部AIに対する<b>運転マニュアル</b>。<br />
              だから、気分の話より<b>次の具体行動</b>に寄せるほど強い。
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.h2}>ゲストモードとデータ</h2>
          <p className={styles.p}>
            ゲストモードでは、作ったリストや下書きは <b>この端末のブラウザ（localStorage）</b> に保存される。<br />
            端末を変えると引き継がれない。ブラウザデータ削除でも消える。
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.h2}>ロードマップ（あとで育てると強いところ）</h2>
          <ul className={styles.ul}>
            <li>テンプレの種類（確定申告 / 発送改善 / クローズドリリース みたいな型）</li>
            <li>発行プロンプトのバージョン管理（ユーザーが選べる）</li>
            <li>作業ログ（今日やったこと）→ 翌日の“最初の5分” を自動生成</li>
            <li>スマホUI最適化（親指オペレーション）</li>
          </ul>
        </section>

        <footer className={styles.footer}>
          <Link className={styles.navBtn} href="/lists">
            ← Listsへ戻って使う
          </Link>
          <Link className={styles.navBtn} href="/help">
            📘 Helpを見る
          </Link>
        </footer>
      </div>
    </main>
  );
}
