export default function HelpPage() {
  return (
    <main style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>使い方</h1>
      <p style={{ marginTop: 10, opacity: 0.8 }}>
        BarabaraDoは「分解して終わり」じゃなくて、「実行まで進む」ためのToDo分解ツール。
        下書き→分類→編集→プロンプト発行、の流れで進める。
      </p>

      <section style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>まず知っておくこと</h2>
        <ul style={{ marginTop: 10, lineHeight: 1.8 }}>
          <li>
            <b>下書き</b>は自由メモ。思いついた順でOK。AIに取り込んでも<b>消えない</b>。
          </li>
          <li>
            <b>チェックリスト</b>は5カテゴリ（目的/段取り/予算/手続き/準備）に整理された実行プラン。
            追加・削除・チェックできる。
          </li>
          <li>
            <b>プロンプト発行</b>は最終工程。チェックリストを材料に、あなたのAIに貼れる「伴走指示書」を作る。
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>基本の流れ（おすすめ）</h2>

        <ol style={{ marginTop: 10, lineHeight: 1.9 }}>
          <li>
            <b>まず自由に書く（下書き）</b>
            <div style={{ opacity: 0.8 }}>例：不安・理由・やること候補・買うもの・調べること</div>
          </li>
          <li>
            <b>AIで5カテゴリに分ける（取り込み）</b>
            <div style={{ opacity: 0.8 }}>
              下書きの内容を、目的/段取り/予算/手続き/準備に整理してチェックリスト化する。
            </div>
          </li>
          <li>
            <b>チェックリストを編集</b>
            <div style={{ opacity: 0.8 }}>
              いらない項目は削除、足りない項目は＋追加。チェックを入れながら進める。
            </div>
          </li>
          <li>
            <b>最後に：プロンプト発行</b>
            <div style={{ opacity: 0.8 }}>
              完成したチェックリストを材料に、あなたのAI（ChatGPTなど）に貼る「伴走プロンプト」を作る。
            </div>
          </li>
          <li>
            <b>自分のAIに貼って自走</b>
            <div style={{ opacity: 0.8 }}>
              「今日の最初の一歩は？」「30分で進めるなら？」「詰まった、代案は？」をAIに相談できる。
            </div>
          </li>
        </ol>
      </section>

      <section style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>プロンプト発行で何がうれしい？</h2>
        <p style={{ marginTop: 10, lineHeight: 1.8 }}>
          プロンプトを発行すると、このチェックリストが前提条件になって、あなたのAIが「専属の伴走コーチ」になる。
          つまり、<b>作戦（チェックリスト）を、実行（次の一手）に変える</b>ための指示書が手に入る。
        </p>

        <ul style={{ marginTop: 10, lineHeight: 1.8 }}>
          <li>次に何をやるか迷わない（AIが順番を決める）</li>
          <li>抜け漏れに気づける（期限・見積・予算・手続き）</li>
          <li>詰まっても前に進める（代案、分岐、最小手数）</li>
          <li>気分が落ちた時も進める（やる気の再設計）</li>
        </ul>
      </section>

      <section style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>コピー機能（4つ）</h2>
        <ul style={{ marginTop: 10, lineHeight: 1.8 }}>
          <li>
            <b>チェックリストをコピー</b>：今の実行プランだけ持ち出したい時
          </li>
          <li>
            <b>プロンプト発行（最終）</b>：伴走用の指示書を作る
          </li>
          <li>
            <b>プロンプトだけコピー</b>：自分のAIに貼るため
          </li>
          <li>
            <b>チェックリスト＋プロンプトをコピー</b>：まとめて別ツールに保存したい／共有したい時
          </li>
        </ul>
        <p style={{ marginTop: 10, opacity: 0.8 }}>
          ※「チェックリスト＋プロンプトをコピー」は、プロンプト未発行なら自動で発行してからコピーできる。
        </p>
      </section>

      <section style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>ゲストモードについて</h2>
        <p style={{ marginTop: 10, lineHeight: 1.8 }}>
          ゲストモードでは、データはこの端末のブラウザ（localStorage）に保存される。
          だから<b>別PCや別ブラウザだと見えない</b>。共有や引き継ぎをしたいなら、コピー機能で持ち出すのが確実。
        </p>
      </section>

      <p style={{ marginTop: 24, opacity: 0.7 }}>
        困ったら：「下書きに戻って、とにかく思いつきを書く」→「AI取り込み」→「不要は削除」だけで前に進める。
      </p>
    </main>
  );
}
