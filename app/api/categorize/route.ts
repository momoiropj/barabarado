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

function normalizeTitle(s: string) {
  return s
    .trim()
    .replace(/^[-*•\d.\)\s]+/, "") // bullets/numbering
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseDraftLines(draft: string): string[] {
  return draft
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-*•\d.\)\s]+/, "").trim())
    .filter(Boolean);
}

function makeId() {
  return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function baseBuckets(): Bucket[] {
  return [
    { key: "motivation", label: "目的・動機", items: [] },
    { key: "plan", label: "段取り（期限/見積）", items: [] },
    { key: "budget", label: "予算（仮でOK）", items: [] },
    { key: "procedure", label: "手続き（連絡/申請/予約）", items: [] },
    { key: "setup", label: "準備（道具/環境/リスク）", items: [] },
  ];
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY is missing" }, { status: 500 });
    }

    const body = await req.json();
    const goal: string = body.goal ?? "";
    const draftText: string = body.draftText ?? "";
    const existingBuckets: Bucket[] | null = body.existingBuckets ?? null;

    if (!goal.trim()) {
      return Response.json({ error: "goal is required" }, { status: 400 });
    }

    const draftLines = parseDraftLines(draftText);
    const existing = Array.isArray(existingBuckets) ? existingBuckets : null;

    // 既存の完了/見積は保持してマージするため、モデルには「既存タイトルのリスト」だけ渡す（重複回避用）
    const existingTitles = (existing ?? [])
      .flatMap((b) => b.items ?? [])
      .map((it) => it?.title)
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .slice(0, 120); // 念のため制限

    const system = `
あなたはToDo分解の編集者。ユーザーの自由記入（draft）を5カテゴリに分類し、必要なら一般的な補完タスクも提案する。
重要：
- 出力は必ずJSONのみ（余計な文章禁止）
- bucketsは必ずこの5つ（順番固定）：motivation, plan, budget, procedure, setup
- draftLinesをできるだけ分類して入れる（曖昧なら最も近いカテゴリへ）
- さらに各カテゴリに「一般的に抜けがちな補完」を0〜2件だけ追加して良い（やりすぎ禁止）
- estimate_min は 5 / 10 / 15 / 30 / 60 のいずれか
- 既存タイトル(existingTitles)と同じ/かなり近いものは作らない（重複回避）
- itemsは title と estimate_min のみ（id/doneは不要）
`;

    const user = `
【ゴール】${goal}

【draftLines】（ユーザーの自由記入）
${JSON.stringify(draftLines)}

【existingTitles】（すでにチェックリストにあるタイトル。重複を避けて）
${JSON.stringify(existingTitles)}

次のJSON形式で出力して：
{
  "buckets": [
    { "key":"motivation", "label":"目的・動機", "items":[{"title":"...", "estimate_min":5}] },
    { "key":"plan", "label":"段取り（期限/見積）", "items":[{"title":"...", "estimate_min":5}] },
    { "key":"budget", "label":"予算（仮でOK）", "items":[{"title":"...", "estimate_min":5}] },
    { "key":"procedure", "label":"手続き（連絡/申請/予約）", "items":[{"title":"...", "estimate_min":5}] },
    { "key":"setup", "label":"準備（道具/環境/リスク）", "items":[{"title":"...", "estimate_min":5}] }
  ]
}
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

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Failed to parse JSON from model", raw }, { status: 500 });
    }

    const incoming = parsed?.buckets;
    if (!Array.isArray(incoming)) {
      return Response.json({ error: "Invalid response shape", raw }, { status: 500 });
    }

    // ベース（空）＋既存を乗せる
    const merged = baseBuckets();

    // 既存をまず入れる（done/estimate保持）
    if (existing) {
      const map = new Map<BucketKey, Bucket>();
      for (const b of merged) map.set(b.key, b);
      for (const b of existing) {
        if (!b?.key || !map.has(b.key)) continue;
        const target = map.get(b.key)!;
        const items = Array.isArray(b.items) ? b.items : [];
        for (const it of items) {
          if (!it?.title) continue;
          target.items.push({
            id: it.id ?? makeId(),
            title: String(it.title),
            estimate_min: Number(it.estimate_min ?? 5),
            done: Boolean(it.done),
          });
        }
      }
    }

    // 重複チェック用
    const seen = new Set<string>();
    for (const b of merged) {
      for (const it of b.items) seen.add(normalizeTitle(it.title));
    }

    // incoming を追加（done=false）
    const byKey = new Map<BucketKey, Bucket>();
    for (const b of merged) byKey.set(b.key, b);

    for (const b of incoming) {
      const key = b?.key as BucketKey;
      const target = byKey.get(key);
      if (!target) continue;

      const items = Array.isArray(b.items) ? b.items : [];
      for (const it of items) {
        const title = typeof it?.title === "string" ? it.title : "";
        const tnorm = normalizeTitle(title);
        if (!tnorm) continue;
        if (seen.has(tnorm)) continue;

        const est = Number(it?.estimate_min ?? 5);
        const allowed = new Set([5, 10, 15, 30, 60]);
        target.items.push({
          id: makeId(),
          title: title.trim(),
          estimate_min: allowed.has(est) ? est : 5,
          done: false,
        });
        seen.add(tnorm);
      }
    }

    return Response.json({ buckets: merged }, { status: 200 });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
