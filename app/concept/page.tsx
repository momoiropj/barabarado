import SiteHeader from "@/app/components/SiteHeader";
import styles from "./page.module.css";

export const metadata = {
  title: "Concept | BarabaraDo",
};

export default function ConceptPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Concept</h1>
          <p className={styles.lead}>
            BarabaraDoは「やること」を増やすアプリじゃない。
            <b>やる気が消える前に、最初の一歩を確定させる</b>ためのアプリ。
          </p>

          <section className={styles.card}>
            <h2 className={styles.h2}>BarabaraDoの思想</h2>
            <ul className={styles.ul}>
              <li>
                <b>心理 → 設計 → 実行</b>の順で分解する（いきなり手順に飛ばない）
              </li>
              <li>
                不明点があっても止まらない（仮定を置いて前に進む）
              </li>
              <li>
                “完了条件” を決める（ゴールが曖昧だと永遠に終わらない）
              </li>
              <li>
                15分のNext Actionを3つ出して、今日を勝ちに行く
              </li>
            </ul>
          </section>

          <section className={styles.card}>
            <h2 className={styles.h2}>バトンパス（プロンプト発行）とは？</h2>
            <p className={styles.p}>
              BarabaraDo内で作ったチェックリストや状況を、あなたが普段使ってるAIに渡すための「引き継ぎ文」。
              ここが強いと、AIがあなた向けにカスタマイズしたり、「次これやろう」を提案しやすくなる。
            </p>
            <div className={styles.note}>
              目標：あなたのAIが<br />
              「OK，BarabaraDoからバトンパスされたよ！ここからは私がサポートするよ」<br />
              みたいに、自然に伴走を始める状態。
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.h2}>安全・注意</h2>
            <ul className={styles.ul}>
              <li>AIの出力は提案。最終判断はあなた</li>
              <li>個人情報や機密情報は貼らないのが基本</li>
              <li>プロンプトは“コピペで動く”ことを最優先に設計</li>
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
