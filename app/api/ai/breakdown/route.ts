import OpenAI from "openai";
import { NextResponse } from "next/server";
import { BARABARADO_SYSTEM_PROMPT } from "@/lib/prompts/barabarado";

export const runtime = "nodejs"; // OpenAI SDKを安全に動かす

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ReqBody = {
  todo?: string;
  context?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    const todo = (body.todo ?? "").trim();
    const context = (body.context ?? "").trim();

    if (!todo) {
      return NextResponse.json(
        { error: "todo が空だよ。ToDoを入れてね。" },
        { status: 400 }
      );
    }

    const userMessage = [
      `todo: ${todo}`,
      `context: ${context || "(なし)"}`,
      "",
      "上の入力を、指定の出力形式で分解して。",
    ].join("\n");

    const response = await client.responses.create({
      model: "gpt-5.2",
      // 文章を安定させたいなら低めの推論でもOK（任意）
      // reasoning: { effort: "low" },
      input: [
        { role: "developer", content: BARABARADO_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    return NextResponse.json({
      text: response.output_text,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "AI分解に失敗した。サーバーログも見てね。" },
      { status: 500 }
    );
  }
}
