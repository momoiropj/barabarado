// app/api/ai/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function extractOutputText(json: any): string {
  // SDKでは output_text があるけど、fetch直叩きだと基本 output 配列から拾う
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
    const todo = String(body?.todo ?? body?.draft ?? "");
    const context = String(body?.context ?? "");

    if (!todo.trim()) {
      return NextResponse.json({ error: "todo が空" }, { status: 400 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const instructions = [
      "あなたは『実行に強いToDo分解コーチ』。",
      "ユーザーの下書き（雑メモ）を読み、構造化して『ゴール』『最初のToDo5つ』が出るように導く。",
      "日本語で出力する。",
      "余計な前置き・自己紹介・注意書きは禁止。",
    ].join("\n");

    const input = [
      "【ユーザーの下書き / ToDo】",
      todo,
      "",
      "【出力ルール】",
      context || "(ルールなし)",
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
        temperature: 0.3,
        max_output_tokens: 1400,
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
