// app/api/ai/breakdown/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function extractOutputText(json: any): string {
  const direct = typeof json?.output_text === "string" ? json.output_text : "";
  if (direct.trim()) return direct;

  const out = json?.output;
  if (!Array.isArray(out)) return "";

  let acc = "";
  for (const item of out) {
    if (item?.type !== "message") continue;
    if (item?.role && item.role !== "assistant") continue;
    const content = item?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c?.type === "output_text" && typeof c?.text === "string") {
        acc += (acc ? "\n" : "") + c.text;
      }
    }
  }
  return acc;
}

function extractOpenAIError(json: any): string {
  const msg = json?.error?.message ?? json?.message;
  if (typeof msg === "string" && msg.trim()) return msg.trim();
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY が未設定。Vercelの Environment Variables（Production）に追加してね。" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const todo = String(body?.todo ?? "");
    const context = String(body?.context ?? "");

    if (!todo.trim()) {
      return NextResponse.json({ error: "todo が空" }, { status: 400 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const instructions = [
      "あなたは『実行に強いToDo分解コーチ』。",
      "ユーザーのToDoを、実行できる小さなサブToDoに分解する。",
      "日本語で出力する。",
      "出力は必ずMarkdownの箇条書きだけ（説明・見出し・前置き禁止）。",
      "1行1タスクで、各行は「〜する」で終える。",
    ].join("\n");

    const input = [
      "【対象ToDo】",
      todo,
      "",
      context ? "【補足】\n" + context : "",
    ].join("\n");

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        temperature: 0.2,
        max_output_tokens: 800,
        store: false,
        text: { format: { type: "text" } },
      }),
    });

    const rawText = await r.text();
    let json: any = null;
    try {
      json = JSON.parse(rawText);
    } catch {
      // no-op
    }

    if (!r.ok) {
      const msg = extractOpenAIError(json) || rawText || `HTTP ${r.status}`;
      return NextResponse.json({ error: msg }, { status: r.status });
    }

    const text = extractOutputText(json);
    if (!text.trim()) {
      return NextResponse.json({ error: "AIの返答が空だった" }, { status: 500 });
    }

    return NextResponse.json({ text });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
