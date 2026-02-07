import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ConceptPage() {
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
    quote: {
      marginTop: 10,
      padding: 12,
      border: "1px solid var(--border2)",
      borderRadius: 12,
      background: "var(--card2)",
      lineHeight: 1.9,
    },
  };

  return (
    <main style={S.page}>
      {/* 上：導線 */}
      <div style={S.btnRow}>
        <Link href="/lists" style={S.btnLink}>
          ← ToDoリストに戻る
        </Link>
        <Link href="/help" style={S.btnLink}>
          使い方を見る →
        </Link>
      </div>

      <h1 style={{ ...S.title, marginTop: 14 }}>コンセプト</h1>
      <p style={S.sub}>
        バラバラDoは、「やる気」ではなく<b>構造</b>で前に進めるためのToDo支援ツール。
        ぐちゃっとした頭の中を、行動できる形に“バラバラ”にして、次の一手が出る状態にする。
      </p>

      <section style={S.card}>
        <h2 style={S.h2}>このツールが解決したいこと</h2>
        <p style={S.sub}>
          「やるべきことは分かってるのに進まない」って、根性不足じゃなくて情報の形が悪いことが多い。
          そこでこのツールは、最初に“考えるべき枠”を用意して、迷いを減らす。
        </p>
        <ul style={S.ul}>
          <li>何から手を付ければいいか分からない</li>
          <li>決めることが多すぎて止まる</li>
          <li>見積り・期限・予算・手続きがごちゃつく</li>
          <li>AIに相談したいけど、何を投げればいいか分からない</li>
        </ul>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>5カテゴリに分ける理由</h2>
        <p style={S.sub}>
          どんなToDoでも、詰まる場所はだいたい決まってる。だから最初から5つに分ける。
          これが「一生進まない巨大ToDo」を「今日できる小さな一手」に変えるコア。
        </p>

        <div style={S.quote}>
          <b>目的・動機</b>：なぜやる？終わったら何が嬉しい？（“やる理由”が言語化されると強い）<br />
          <b>段取り（期限/見積）</b>：いつまで？どれくらい？順番は？（やるべき順が決まる）<br />
          <b>予算（仮でOK）</b>：相場/上限/必要経費（お金の不安を減らす）<br />
          <b>手続き（連絡/申請/予約）</b>：誰に何を？（ここが抜けると詰む）<br />
          <b>準備（道具/環境/リスク）</b>：道具・場所・失敗回避（安心して動ける）
        </div>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>プロンプト発行で何がうれしい？</h2>
        <p style={S.sub}>
          ここがこのツールの“加速装置”。プロンプトは「あなたのAIに渡す伴走用の指示書」。
          チェックリストを材料にして、あなたのAIが<b>詰まりの特定 → 次の一手 → 進捗管理</b>までやりやすくなる。
        </p>
        <ul style={S.ul}>
          <li>相談のたびに背景説明しなくていい（AIが前提を持てる）</li>
          <li>「次に何をする？」が毎回クリアになる</li>
          <li>見積りや優先度のブレを減らせる</li>
        </ul>
      </section>

      <section style={S.note}>
        <h2 style={S.h2}>テスト版の前提（安全のため）</h2>
        <p style={S.sub}>
          テスト期間はまずゲストモード中心。保存は端末内（ブラウザ）だから、気軽に試せる一方で制約もある。
        </p>
        <ul style={{ ...S.ul, color: "var(--muted)", fontSize: 13 }}>
          <li>内容はこの端末のブラウザ内に保存（別端末では見えない）</li>
          <li>ブラウザのデータ削除等で消える可能性 → 大事なものはコピーで保存</li>
          <li>
            AI分解／プロンプト発行では内容が送信されるので、
            <span style={S.danger}>個人情報・社外秘は入れない</span>
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
