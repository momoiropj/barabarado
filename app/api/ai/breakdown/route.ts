import { NextResponse } from "next/server";

export const runtime = "nodejs";

type BreakdownRequest =
  | { text: string; context?: string }
  | { todo: string; context?: string }
  | Record<string, unknown>;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function buildAnalysisPrompt(text: string, context?: string) {
  const ctx = (context ?? "").trim();

  return `あなたは「実行に強いToDo分解コーチ」。ユーザーの下書き（雑メモ）から、ゴール（完了条件）と分解（L1→L2→L3）を作り、今すぐ動ける形にしてください。

${ctx ? `【追加の指示】
${ctx}
` : ""}

【出力ルール（必ず守る）】
- 日本語
- 前置き/解説/注意書きなし（いきなり本文）
- 出すのは次の2セクションだけ（この順番・見出しも固定）：
  【3. 完了条件（目指すゴール）】
  【4. 分解（L1→L2→L3）】
- 完了条件はチェック式で3〜5個：
  - [ ] ...
- 分解は行単位で L1 / L2 / L3 を必ず明記する
- L3 は必ず「〜する」で終える（質問形は禁止）
- 不明点があっても質問はしない。必要なら “（仮）” と書いて仮置きで進める

【下書き】
${text.trim()}
`;
}

function buildDecomposePrompt(todo: string, context?: string) {
  const ctx = (context ?? "").trim();
  return `あなたは「実行に強いToDo分解コーチ」。指定されたToDoを“次の一歩”が迷わない粒度に分解してください。

【ルール】
- 日本語
- 箇条書きのみ（1行1タスク）
- 最大7個
- 先頭に余計な見出しは不要
- できれば「準備→実行→確認→次」になる順

【コンテキスト（あれば）】
${ctx || "（なし）"}

【ToDo】
${todo.trim()}
`;
}

async function callOpenAIChatCompletions(apiKey: string, model: string, prompt: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        { role: "system", content: "You are a helpful, precise assistant." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`OpenAI API error (${res.status}): ${msg}`);
  }

  const text =
    typeof data === "string"
      ? data
      : (data?.choices?.[0]?.message?.content as string | undefined) ?? "";

  return text;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as BreakdownRequest;

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      return NextResponse.json(
        { text: "", error: "OPENAI_API_KEY が未設定です（Vercelの環境変数を確認してね）" },
        { status: 500 }
      );
    }

    // 1) 下書き→分析
    if (isNonEmptyString((body as any).text)) {
      const prompt = buildAnalysisPrompt((body as any).text, (body as any).context);
      const text = await callOpenAIChatCompletions(apiKey, model, prompt);
      return NextResponse.json({ text });
    }

    // 2) さらに分解
    if (isNonEmptyString((body as any).todo)) {
      const prompt = buildDecomposePrompt((body as any).todo, (body as any).context);
      const text = await callOpenAIChatCompletions(apiKey, model, prompt);
      return NextResponse.json({ text });
    }

    return NextResponse.json({ text: "", error: "リクエスト形式が不正です" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ text: "", error: e?.message ?? String(e) }, { status: 500 });
  }
}
