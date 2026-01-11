import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Mode = "first_step" | "research" | "budget" | "setup";

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY is missing" }, { status: 500 });
    }

    const body = await req.json();
    const goal: string = body.goal ?? "";
    const mode: Mode = body.mode ?? "first_step";

    if (!goal.trim()) {
      return Response.json({ error: "goal is required" }, { status: 400 });
    }

    const modeHint: Record<Mode, string> = {
      first_step: "最初の一歩（5〜10分でできる行動）を中心に分解する",
      research: "情報収集（調べる/比較する/問い合わせる）を中心に分解する",
      budget: "予算（概算/見積り/支払い/優先順位）を中心に分解する",
      setup: "段取り（準備物/手配/スケジュール/依頼）を中心に分解する",
    };

    const system = `
あなたは「大きな目標を、いま実行できるTodoに分解する」アシスタント。
必ずJSONのみで返す。余計な文章は禁止。
各Todoは短く、動詞から始める（例：比較する、予約する、問い合わせる）。
`;

    const user = `
目標: ${goal}
分解の方針: ${modeHint[mode]}

JSON形式で返して:
{
  "title": "（リストの短いタイトル）",
  "todos": [
    {"title":"...", "tag":"first_step|research|budget|setup", "estimate_min": 5}
  ]
}
todosは8〜15個。estimate_minはだいたいの分数（5〜90）。
tagは上の4種類のみ。
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
