// app/api/ai/breakdown/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BreakdownDraftReq = { text: string; context?: string };
type BreakdownTodoReq = { todo: string; context?: string };

function isDraftReq(body: any): body is BreakdownDraftReq {
  return body && typeof body.text === "string" && body.text.trim().length > 0;
}

function isTodoReq(body: any): body is BreakdownTodoReq {
  return body && typeof body.todo === "string" && body.todo.trim().length > 0;
}

function env(name: string, fallback?: string) {
  const v = process.env[name];
  return (v && v.trim().length > 0 ? v : fallback) as string | undefined;
}

function buildSystemPrompt() {
  // “ツールの人格”はここで固定（ただし出力フォーマットは user/context に従う）
  return [
    "あなたは『実行に強いToDo分解コーチ』。",
    "ユーザーは、面倒・ストレス・不明瞭さで着手できないことがある。感情を否定せず、摩擦を下げてフラットに着手させる。",
    "",
    "【最重要：カテゴリ設計（必須）】",
    "カテゴリ（L1）は必ず以下4つを含める：",
    "- 目的（なぜやる/達成したいこと）",
    "- 予算感（コスト・上限・レンジ）",
    "- 準備（集める/用意/確認）",
    "- 段取り（順番/担当/期限/手順）",
    "必要なら追加カテゴリを増やしてよい（例：保留/未確定/リスク）。ただし上の4つは必須。",
    "",
    "【止まりがちな出力を禁止】",
    "- 『言語化する』『調べる』だけで止めない。もし入れるなら対象を具体化する（例：『提出方法を選ぶ（オンライン/窓口）』）。",
    "- どんなテーマでも『ルート選択 → 準備 → 実行 → 完了確認』の流れがToDoから読み取れるようにする。",
    "",
    "【日本語ルール】",
    "- ToDo文は『〜する』で統一しない。自然な動詞で終える（決める/集める/出す/確認する/選ぶ/提出する/連絡する 等）。",
    "- 破綻した語尾は禁止（例：『決めるする』）。",
    "- 1項目は1アクション。短く、具体的に。",
    "",
    "【情報が少ないとき】",
    "- 断定せず、一般的な前提を置いた“仮定ベース”で進める。",
    "- 見込み（工数/期間/予算）は、ユーザーに調べさせず、一般的なレンジを先に提示する（目安）。",
    "",
    "【出力フォーマット】",
    "- 具体的な出力フォーマットは、ユーザーの指示（context/プロンプト内のルール）を最優先で厳守する。",
  ].join("\n");
}

function buildDefaultDraftFormatRules() {
  return [
    "【出力フォーマット（構造文法・厳守）】",
    "- Markdownで出す",
    "- 出すのは次の2セクションだけ：",
    '  【3. 完了条件（目指すゴール）】…チェック式 "- [ ]" で3〜5個（状態を書く：〜になっている/〜が揃っている）',
    "  【4. 分解（L1→L2→L3）】…L1はカテゴリ / L3は具体アクション",
    "- L1 は最低4つ（目的/予算感/準備/段取り）",
    '- L3 は必ず行頭に "L3:" を付ける（抽出しやすくするため）',
    "- 質問形は禁止（？を出さない）",
    "- 余計な前置き/注意書き/自分語りは禁止（いきなり本文）",
  ].join("\n");
}

function buildDraftUserPrompt(text: string, context?: string) {
  const rules = context?.trim() ? context.trim() : buildDefaultDraftFormatRules();
  return [
    "ユーザーの下書き（draft）を分析し、完了条件とカテゴリ分解を生成してください。",
    "",
    rules,
    "",
    "【下書き】",
    text,
  ].join("\n");
}

function buildTodoUserPrompt(todo: string, context?: string) {
  return [
    "単一ToDoを、ユーザーが着手できるレベルまで分解してください。",
    "『言語化/調べる』で止まらず、ルート選択→準備→実行→確認までToDoに落としてください。",
    "",
    `【ToDo】\n${todo}`,
    context && context.trim().length > 0 ? `\n【追加情報（制約/前提/気持ち/メモ）】\n${context.trim()}` : "",
  ].join("\n");
}

async function callOpenAI(messages: Array<{ role: "system" | "user"; content: string }>) {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) {
    return { ok: false as const, status: 500, text: "OPENAI_API_KEY is missing" };
  }

  const model = env("OPENAI_MODEL", "gpt-4o-mini")!;
  const baseUrl = env("OPENAI_BASE_URL", "https://api.openai.com/v1")!;
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages,
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    return { ok: false as const, status: res.status, text: raw || `OpenAI error: ${res.status}` };
  }

  const data = (await res.json()) as any;
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    return { ok: false as const, status: 500, text: "No content in OpenAI response" };
  }

  return { ok: true as const, status: 200, text: content };
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ text: "Invalid JSON body" }, { status: 400 });
  }

  if (!isDraftReq(body) && !isTodoReq(body)) {
    return NextResponse.json(
      { text: "Body must be { text: string, context?: string } OR { todo: string, context?: string }" },
      { status: 400 }
    );
  }

  const system = buildSystemPrompt();
  const user = isDraftReq(body)
    ? buildDraftUserPrompt(body.text, body.context)
    : buildTodoUserPrompt(body.todo, body.context);

  const result = await callOpenAI([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);

  if (!result.ok) {
    return NextResponse.json({ text: result.text }, { status: result.status });
  }

  return NextResponse.json({ text: result.text }, { status: 200 });
}
