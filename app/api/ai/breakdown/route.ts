// app/api/ai/breakdown/route.ts
// NOTE: 「AI分析（下書き→ゴール&分解）」と「さらに分解（単一ToDo→サブToDo）」を同じエンドポイントで扱う

export const runtime = "nodejs";

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

function json(data: JsonValue, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

function getEnv(name: string) {
  const v = process.env[name];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function safeText(v: unknown) {
  if (typeof v !== "string") return "";
  return v.replace(/\r\n/g, "\n");
}

/**
 * Chat Completions（互換）を叩いて、assistantのテキストを返す
 */
async function callOpenAIChatCompletions(apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI error: ${res.status} ${res.statusText}\n${raw.slice(0, 2000)}`);
  }

  try {
    const data = JSON.parse(raw);
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : "";
  } catch {
    throw new Error(`OpenAI response parse failed\n${raw.slice(0, 2000)}`);
  }
}

/**
 * 重要：最初の方針（目的/予算感/準備/段取り）をカテゴリとして復活
 * 重要：語尾を機械的に「する」で統一しない（自然な日本語）
 */
const SYSTEM_PROMPT = `
あなたは「実行に強いToDo分解コーチ」。
ユーザーの下書きから、実行できる粒度に分解し、次に何をすれば進むかを明確にする。

【最重要方針：カテゴリ設計（必須）】
- L1（カテゴリ）として、必ず次の4つを入れる：
  1) 目的（なぜやる/何を達成したい）
  2) 予算感（お金・コスト・上限）
  3) 準備（集める/用意する/確認する）
  4) 段取り（順番/誰に/いつまで/手順）
- 必要なら追加カテゴリもOK（例：連絡、調査、手続き）。ただし上の4つは必須。

【日本語ルール】
- すべての行末を「する」に統一しない
- 可能なら自然な動詞で終える（例：決める/買う/書く/作る/まとめる/確認する）
- 「決めるする」「作るする」みたいな不自然な語尾は禁止

【出力フォーマット（厳守）】
- Markdownで出す
- 出すのは次の2セクションだけ（順番・見出し名も同じ）：
  【3. 完了条件（目指すゴール）】…チェック式 "- [ ]" で3〜5個
  【4. 分解（L1→L2→L3）】…行単位で L1 / L2 / L3 を明記
- L3 は必ず行頭に "L3:" を付ける（抽出用）
- L3 は「いま自分ができる行動」だけ（抽象語・精神論・質問形は禁止）
`.trim();

function buildAnalysisPrompt(draft: string) {
  return `
下書きを読んで、上のルールに従って「ゴール」と「分解（カテゴリ設計あり）」を作ってください。

【下書き】
${draft}
`.trim();
}

function buildDecomposePrompt(todo: string, context?: string) {
  const ctx = (context ?? "").trim();
  return `
次の ToDo を、いますぐ着手できるサブToDo（L3）に分解して。
カテゴリ設計の方針に沿って、どのカテゴリに入るかも明示して。

【ToDo】
${todo}

${ctx ? `【補足（状況）】\n${ctx}\n` : ""}

【出力フォーマット（厳守）】
- Markdown
- 出すのは【4. 分解（L1→L2→L3）】だけ
- L1 は「目的/予算感/準備/段取り」に必ず紐づける
- L3 は必ず "L3:" で始める
- 行末は「する」で統一しない（自然な日本語）
`.trim();
}

export async function POST(req: Request) {
  try {
    const apiKey = getEnv("OPENAI_API_KEY");
    if (!apiKey) {
      return json(
        { error: "OPENAI_API_KEY が未設定。VercelのEnvironment Variables（Production）に追加してね。" },
        { status: 500 }
      );
    }

    const model = getEnv("OPENAI_MODEL") ?? "gpt-4o-mini";

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const text = safeText(body?.text);
    const todo = safeText(body?.todo);
    const context = safeText(body?.context);

    // 1) 下書き分析モード（推奨）
    if (text.trim()) {
      const prompt = buildAnalysisPrompt(text.trim());
      const out = await callOpenAIChatCompletions(apiKey, model, prompt);
      return json({ text: out });
    }

    // 2) 単一ToDo分解モード
    if (todo.trim()) {
      const prompt = buildDecomposePrompt(todo.trim(), context);
      const out = await callOpenAIChatCompletions(apiKey, model, prompt);
      return json({ text: out });
    }

    return json({ error: "入力が空。{ text }（下書き）か { todo }（単一ToDo）を送ってね。" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, { status: 500 });
  }
}
