import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type BucketKey = "motivation" | "plan" | "budget" | "procedure" | "setup";

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
ユーザーが“どう決めていいか分からない”状態でも、前に進める形にする。

重要：
- 出力は必ずJSONのみ（余計な文章禁止）
- 5カテゴリに分けて各5件（合わないものはユーザーが後で削除できる前提でOK）
- 各カテゴリの1つ目は必ず5分でできる行動にする
- 予算は一般論・仮置きでOK（例：消耗品/外注/交通費/手数料など）
- 手続きは「必要かもしれない候補」でOK（予約/連絡/申請/ルール確認など）
- 最後に “自分のAIで続きが進められる” コピペ用プロンプトを必ず付ける
- estimate_min は 5 / 10 / 15 / 30 / 60 のどれか
`;

    const user = `
ToDo: ${goal}

次のJSON形式で出力して：

{
  "title": "要約タイトル（短く）",
  "buckets": [
    {
      "key": "motivation",
      "label": "目的・動機",
      "items": [
        { "id": "uuidっぽい文字列", "title": "…", "estimate_min": 5 }
      ]
    },
    {
      "key": "plan",
      "label": "段取り（期限/見積）",
      "items": [ { "id": "…", "title": "…", "estimate_min": 5 } ]
    },
    {
      "key": "budget",
      "label": "予算（仮でOK）",
      "items": [ { "id": "…", "title": "…", "estimate_min": 5 } ]
    },
    {
      "key": "procedure",
      "label": "手続き（連絡/申請/予約）",
      "items": [ { "id": "…", "title": "…", "estimate_min": 5 } ]
    },
    {
      "key": "setup",
      "label": "準備（道具/環境/リスク）",
      "items": [ { "id": "…", "title": "…", "estimate_min": 5 } ]
    }
  ],
  "copypaste_prompt": "ユーザーが自分のAIに貼って続きを進めるためのプロンプト（日本語）。［］の穴埋めを含める。"
}

制約：
- bucketsは必ず上の5つ、順番もこのまま
- 各bucket itemsは必ず5個
- idは各itemでユニーク（衝突しなければ何でもOK）
- 各bucketのitems[0]は必ずestimate_min=5
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

    // 最低限の形チェック（壊れたJSONのときの保険）
    if (!data?.buckets || !Array.isArray(data.buckets)) {
      return Response.json({ error: "Invalid response shape", raw }, { status: 500 });
    }

    // keyの正規化（変な値が来た時は落とす）
    const allowed: BucketKey[] = ["motivation", "plan", "budget", "procedure", "setup"];
    data.buckets = data.buckets.filter((b: any) => allowed.includes(b?.key));

    return Response.json(data, { status: 200 });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

