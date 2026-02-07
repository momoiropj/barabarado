export default function ConceptPage() {
  return (
    <main style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>コンセプト</h1>
      <p style={{ marginTop: 10, opacity: 0.85, lineHeight: 1.8 }}>
        BarabaraDoは「やることを増やすアプリ」じゃなくて、
        <b>やれる形にまで“分解して、前に進める”</b>ためのアプリ。
      </p>

      <section style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>なぜ分解が必要？</h2>
        <p style={{ marginTop: 10, lineHeight: 1.9 }}>
          大きいToDoは、<b>不安・迷い・情報不足</b>が混ざって止まりやすい。
          BarabaraDoは「気持ち」「段取り」「予算」「手続き」「準備」に分けて、
          <b>詰まりポイントを見える化</b>する。
        </p>
      </section>

      <section style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>5カテゴリで考える</h2>
        <ul style={{ marginTop: 10, lineHeight: 1.9 }}>
          <li>
            <b>目的・動機</b>：なぜやる？やらないと何が困る？終わったら何が嬉しい？
          </li>
          <li>
            <b>段取り（期限/見積）</b>：いつまで？何分なら進む？順番は？
          </li>
          <li>
            <b>予算（仮でOK）</b>：だいたい何がいくら？上限は？節約案は？
          </li>
          <li>
            <b>手続き（連絡/申請/予約）</b>：誰に連絡？何を予約？必要書類は？
          </li>
          <li>
            <b>準備（道具/環境/リスク）</b>：必要なものは？場所は？失敗の回避策は？
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>ゴールは「自走」</h2>
        <p style={{ marginTop: 10, lineHeight: 1.9 }}>
          チェックリストは設計図。プロンプトはAIに渡す施工指示書。
          最後にプロンプトを発行すると、あなたのAIが
          <b>このToDo専属の伴走コーチ</b>になる。
          だから「次の一手」が途切れない。
        </p>
      </section>

      <section style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>テストユーザーに伝えたい一言</h2>
        <p style={{ marginTop: 10, lineHeight: 1.9 }}>
          「とりあえず下書きに思いつきを書いて、AI取り込みして、いらないものは削除してね。
          最後にプロンプトを発行したら、あなたのAIに貼って実行まで進められるよ。」
        </p>
      </section>
    </main>
  );
}
