import SiteHeader from "@/app/components/SiteHeader";
import styles from "./page.module.css";

export const metadata = {
  title: "Help | BarabaraDo",
};

export default function HelpPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Help</h1>
          <p className={styles.lead}>
            BarabaraDoは「頭の中のモヤ」を分解して、今日から動ける形にするための道具。
            ここでは使い方と、よくある詰まりポイントをまとめるよ。
          </p>

          <section className={styles.card}>
            <h2 className={styles.h2}>基本の流れ</h2>
            <ol className={styles.ol}>
              <li>
                <b>まず自由に書く</b>（下書き）…思いついた順でOK。箇条書きが強い。
              </li>
              <li>
                <b>AIでカテゴリ分け</b>…「気持ち/現状/制約/手順/メモ」に仕分け。
              </li>
              <li>
                <b>チェックリストを編集</b>…足す/消す/チェック。人間が最強。
              </li>
              <li>
                <b>プロンプト発行</b>…コピペであなたのAIにバトンパス。
              </li>
            </ol>
          </section>

          <section className={styles.grid}>
            <section className={styles.card}>
              <h2 className={styles.h2}>ゲストモードについて</h2>
              <ul className={styles.ul}>
                <li>データはこの端末のブラウザ（localStorage）に保存される</li>
                <li>別端末/別ブラウザでは引き継がれない</li>
                <li>ブラウザの履歴削除や再インストールで消える可能性がある</li>
              </ul>
            </section>

            <section className={styles.card}>
              <h2 className={styles.h2}>よくある詰まり</h2>
              <ul className={styles.ul}>
                <li>
                  <b>タスクがデカい</b> → 「15分で終わる最初の一手」に切る
                </li>
                <li>
                  <b>完了条件が曖昧</b> → 第三者がYES/NO判定できる言葉にする
                </li>
                <li>
                  <b>やる気が出ない</b> → “気持ち/現状/なぜ” を1セットだけ書く
                </li>
              </ul>
            </section>
          </section>

          <section className={styles.card}>
            <h2 className={styles.h2}>プロンプト発行のコツ</h2>
            <p className={styles.p}>
              発行されたプロンプトは、そのままあなたのAIに貼り付けてOK。
              AIは「BarabaraDoから引き継いだ」前提で、あなた向けにチェックリストを整えたり、
              次の一手を提案するのが理想。
            </p>
            <div className={styles.note}>
              <b>ポイント：</b> チェックリストが付くときは「以下は現時点でチェックリストになります。」という文言が入ってると、
              AIが状況を誤解しにくい。
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
