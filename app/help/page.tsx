import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HelpPage() {
  const S = {
    page: { padding: 24, maxWidth: 860, margin: "0 auto" as const },
    title: { fontSize: 28, fontWeight: 900, margin: 0 },
    sub: { marginTop: 10, color: "var(--muted)", lineHeight: 1.9 },
    card: {
      marginTop: 16,
      padding: 14,
      border: "1px solid var(--border2)",
      borderRadius: 12,
      background: "var(--card)",
    },
    note: {
      marginTop: 16,
      padding: 14,
      border: "1px solid var(--border2)",
      borderRadius: 12,
      background: "var(--card2)",
    },
    h2: { margin: 0, fontSize: 18, fontWeight: 900 },
    h3: { margin: "12px 0 0", fontSize: 15, fontWeight: 800 },
    ul: { marginTop: 10, paddingLeft: 18, lineHeight: 1.9 },
    btnLink: {
      display: "inline-block",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "8px 12px",
      textDecoration: "none",
      background: "var(--control-bg)",
      color: "var(--control-text)",
    },
    btnRow: { marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" as const },
    danger: { color: "var(--danger)" },
    codeBox: {
      marginTop: 10,
      padding: 12,
      border: "1px solid var(--border2)",
      borderRadius: 12,
      background: "var(--card)",
      overflowX: "auto" as const,
      fontSize: 13,
      lineHeight: 1.7,
    },
  };

  return (
    <main style={S.page}>
      {/* 上：戻る */}
      <div style={S.btnRow}>
        <Link href="/lists" style={S.btnLink}>
          ← ToDoリストに戻る
        </Link>
        <Link href="/concept" style={S.btnLink}>
          コンセプトを見る →
        </Link>
      </div>

      <h1 style={{ ...S.title, marginTop: 14 }}>使い方</h1>
      <p style={S.sub}>
        このツールは「思いつきを、行動できる形にする」ための分解器。
        <b>自由に書く → AIで整理 → 自分で調整 → 最後にプロンプト発行</b>で、あなたのAIと自走できる状態まで持っていく。
      </p>

      <section style={S.note}>
        <h2 style={S.h2}>テスト利用の注意（ゲストモード）</h2>
        <ul style={{ ...S.ul, color: "var(--muted)", fontSize: 13 }}>
          <li>入力内容はこの端末のブラウザ内に保存される（別の端末・別ブラウザでは見えない）</li>
          <li>ブラウザのデータ削除などで消えることがあるので、大事なものは「コピー」で保存</li>
          <li>
            AI分解／プロンプト発行では内容がAPIに送信される。
            <span style={S.danger}>住所・電話・口座・健康情報・社外秘は入れない</span>
          </li>
          <li>固有名詞は「A社」「Bさん」みたいに伏せてOK</li>
        </ul>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>1）まず自由に書く（下書き）</h2>
        <p style={S.sub}>
          思いついた順でOK。箇条書きが強い。ここはAIを押しても消えないので、安心して雑に書く。
        </p>
        <ul style={S.ul}>
          <li>例：やりたいこと／不安／買うもの／連絡先／必要そうな手続き…</li>
          <li>迷ったら「いま詰まってること」をそのまま書くのが効く</li>
        </ul>

        <h3 style={S.h3}>コツ</h3>
        <ul style={S.ul}>
          <li>「できない理由」も立派な材料（AIが段取りに変換しやすい）</li>
          <li>判断が必要なものは「仮でいい」って書いておく</li>
        </ul>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>2）AIで5カテゴリに分ける（取り込み）</h2>
        <p style={S.sub}>
          下書きを、次の5カテゴリに整理してチェックリストへ取り込む。目的は<b>悩みを構造にして前進させる</b>こと。
        </p>

        <ul style={S.ul}>
          <li>
            <b>目的・動機</b>：なぜやる？終わったら何が嬉しい？
          </li>
          <li>
            <b>段取り（期限/見積）</b>：順番・所要時間・締切の仮置き
          </li>
          <li>
            <b>予算（仮でOK）</b>：だいたいの相場／上限／必要な出費
          </li>
          <li>
            <b>手続き（連絡/申請/予約）</b>：誰に何を、いつまでに
          </li>
          <li>
            <b>準備（道具/環境/リスク）</b>：必要な道具、やらかし防止策
          </li>
        </ul>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>3）チェックリストを編集する</h2>
        <p style={S.sub}>
          取り込み後は、<b>チェック／追加／削除</b>ができる。不要は消してOK。あなたの現場に合わせて完成させる。
        </p>
        <ul style={S.ul}>
          <li>追加：各カテゴリの「＋追加」で自分のToDoを足す</li>
          <li>削除：不要な項目は消す（むしろ消すのが正解なこと多い）</li>
          <li>チェック：進捗が見えると継続が楽になる</li>
        </ul>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>4）最後に：プロンプト発行（何がうれしい？）</h2>
        <p style={S.sub}>
          プロンプト発行は、<b>このToDo専用の“AI伴走台本”</b>を作る工程。
          これを自分のAI（ChatGPTなど）に貼ると、「このToDoの背景」と「今あるチェックリスト」を前提に、
          次の一手や詰まり解消を一緒に進められる。
        </p>

        <h3 style={S.h3}>得られるもの</h3>
        <ul style={S.ul}>
          <li>次に何をするか、迷いが減る（“次の1手”が出る）</li>
          <li>詰まりポイントの言語化→解消の提案が出る</li>
          <li>見積り・段取り・リスクの抜け漏れチェックができる</li>
        </ul>

        <h3 style={S.h3}>おすすめの貼り方</h3>
        <div style={S.codeBox}>
          1) 「プロンプトだけコピー」して自分のAIに貼る<br />
          2) 次に「チェックリスト」も貼って、今の進捗を共有<br />
          3) 「今日30分だけ進めたい。次の1手を3つ提案して」みたいに短く依頼する
        </div>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>コピー機能の使い分け</h2>
        <ul style={S.ul}>
          <li>
            <b>チェックリストをコピー</b>：ToDoだけ保存したい
          </li>
          <li>
            <b>プロンプトだけコピー</b>：自分のAIに貼って伴走してもらう
          </li>
          <li>
            <b>チェックリスト＋プロンプトをコピー</b>：全部まとめてバックアップしたい
          </li>
        </ul>
      </section>

      {/* 下：戻る */}
      <div style={{ ...S.btnRow, marginTop: 22 }}>
        <Link href="/lists" style={S.btnLink}>
          ← ToDoリストに戻る
        </Link>
      </div>
    </main>
  );
}
