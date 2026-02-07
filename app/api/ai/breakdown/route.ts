import OpenAI from "openai";
import { NextResponse } from "next/server";
import { BARABARADO_SYSTEM_PROMPT } from "@/lib/prompts/barabarado";


export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ReqBody = { todo?: string; context?: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    const todo = (body.todo ?? "").trim();
    const context = (body.context ?? "").trim();

    console.log("✅ /api/ai/breakdown hit");
    console.log("✅ has OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);

    if (!todo) {
      return NextResponse.json({ error: "todo が空だよ" }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY が読めてない (.env.local を確認して dev 再起動)" },
        { status: 500 }
      );
    }

    const userMessage = [
      `todo: ${todo}`,
      `context: ${context || "(なし)"}`,
      "",
      "上の入力を、指定の出力形式で分解して。",
    ].join("\n");

    // ✅ 60秒で強制タイムアウト
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 60_000);

    const response = await client.responses.create(
      {
        model: "gpt-5.2",
        reasoning: { effort: "low" },
        max_output_tokens: 1200,
        input: [
          { role: "developer", content: BARABARADO_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      },
      { signal: ac.signal }
    );

    clearTimeout(t);

 return NextResponse.json(
  { text: response.output_text },
  {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  }
);


  } catch (err: any) {
    console.error("❌ breakdown error:", err?.message ?? err);

    // Abort（タイムアウト）なら分かりやすく返す
    if (err?.name === "AbortError") {
      return NextResponse.json(
        { error: "OpenAI呼び出しがタイムアウト（60秒）" },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "AI分解に失敗した（サーバーログ確認）" },
      { status: 500 }
    );
  }
}
