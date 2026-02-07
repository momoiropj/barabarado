import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type BucketKey = "motivation" | "plan" | "budget" | "procedure" | "setup";

type ChecklistItem = {
  id: string;
  title: string;
  estimate_min: number;
  done: boolean;
};

type Bucket = {
  key: BucketKey;
  label: string;
  items: ChecklistItem[];
};

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY is missing" }, { status: 500 });
    }

    const body = await req.json();
    const goal: string = body.goal ?? "";
    const buckets: Bucket[] = body.buckets ?? [];

    if (!goal.trim()) return Response.json({ error: "goal is required" }, { status: 400 });
    if (!Array.isArray(buckets) || buckets.length === 0) {
      return Response.json({ error: "buckets is required" }, { status: 400 });
    }

    const compact = buckets.map((b) => ({
      label: b.label,
      items: (b.items ?? []).map((it) => ({
        title: it.title,
        estimate_min: it.estimate_min,
        done: it.done,
      })),
    }));

    const system = `
あなたはToDo実行コーチ。ユーザーが「自分のAI（別のChatGPT等）」と会話しながら自走できるように、貼り付け用プロンプトを作る。
重要：
- 出力はテキストのみ（JSON不要）
- 目的：チェックリストを“実行可能な次アクション”に落とし、迷った時の質問テンプレも付ける
- ユーザーが貼った後、AIが聞くべき質問（期限/優先/制約/完了条件）を最小限に
- 口調は丁寧すぎず実務的、日本語
- 長すぎない（目安 250〜450字くらい、必要なら箇条書きOK）
`;

    const user = `
【ゴール】${goal}

【チェックリスト（done付き）】
${JSON.stringify(compact)}

上記を前提に、貼り付け用プロンプトを作って。
要件：
- まず「今日やる最初の5分」提案
- done=false の項目から優先順位づけの提案
- 迷いが出た時に聞くべき質問を3つ
- 最後に「次にユーザーがコピペすべき回答フォーマット」も付ける（例：今日の残り時間/期限/重要度など）
`;

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const text = resp.output_text ?? "";
    return Response.json({ prompt: text }, { status: 200 });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
