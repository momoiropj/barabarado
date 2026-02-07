import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY is missing" }, { status: 500 });
    }

    const body = await req.json();
    const goal: string = body.goal ?? "";

    if (!goal.trim()) {
      return Response.json({ error: "goal is required" }, { status: 400 });
    }

    const system = `
あなたは「迷って動けない人を動かす」ToDo分解コーチ。
ユーザーが“どう決めていいか分からない”状態でも進められる設計にする。

出力は必ずJSONのみ。余計な文章は禁止。

必須：
- どのToDoでも最初に think_first（考えること）から始める
- 仮案を最低2つ（A/B）出す。進め方の性格が違う案にする
- 最後に copypaste_prompt（自走用コピペプロンプト）を必ず付ける
- 各案の最初のタスクは5分でできる行動にする
- estimate_min は 5 / 10 / 15 / 30 / 60 のどれか
- tag は "first_step" | "research" | "budget" | "setup"
`;

    const user = `
ToDo: ${goal}

次のJSON形式で出力して：
{
  "title": "要約タイトル（短く）",
  "think_first": [
    "目的（なぜやる？）を1行で",
    "期限（いつまで？）",
    "完了の定義（どうなったら終わり？）",
    "制約（時間/お金/体力/場所）",
    "最初の5分アクション"
  ],
  "draft_plans": [
    {
      "title": "案A（例：最短で終わらせる）",
      "todos": [
        { "title": "…", "estimate_min": 5, "tag": "first_step" }
      ]
    },
    {
      "title": "案B（例：迷う人向け・判断を減らす）",
      "todos": [
        { "title": "…", "estimate_min": 5, "tag": "first_step" }
      ]
    }
  ],
  "copypaste_prompt": "ユーザーが自分のAIに貼って続きを進めるためのプロンプト本文（日本語）。［］の穴埋めを含める。"
}

制約：
- think_first は 5〜7個
- 各案のtodosは 8〜15個
- copypaste_prompt は長くてOK。箇条書き指示OK。
`;

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: { format: { type: "json_object" } },
    });

    const raw = resp.output_text;

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Failed to parse JSON from model", raw }, { status: 500 });
    }

    return Response.json(data, { status: 200 });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
