// app/lists/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import styles from "./page.module.css";

type ListRow = {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
  isCompleted?: boolean;
  data?: unknown;
};

type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  category?: string;
  status?: "unknown" | "later" | "normal";
  note?: string;
  groupId?: string;
};

type GroupItem = {
  id: string;
  title: string;
};

type StageSnapshot = {
  id: string;
  createdAt: number;
  label: string;
  draft: string;
  goals: string[];
  todos: TodoItem[];
  groups: GroupItem[];
  aiResult: string;
  stage: number;
  archivedDone: number;
};

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function isBrowser() {
  return typeof window !== "undefined";
}

function getLocalKey(listId: string) {
  return `barabarado:list:${listId}`;
}

function getLocalMetaKey(listId: string) {
  return `barabarado:listmeta:${listId}`;
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function normalizeTodoText(s: string) {
  let t = (s ?? "").trim();

  // 先頭の箇条書き記号などを除去
  t = t.replace(/^[-*・●\s]+/, "");
  t = t.replace(/^(\d+[\.\\)]\s+)/, "");

  // 末尾の句点だけ削る（「。」を連打しないため）
  t = t.replace(/[。．]+$/, "");

  // 変な二重語尾を軽く整形
  t = t.replace(/決めるする/g, "決める");
  t = t.replace(/するする/g, "する");

  return t.trim();
}

/** 分析から「余計なメタ情報（【1】【2】）」が混ざっても、3/4だけ残す */
function sanitizeAnalysis(raw: string): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  // 【3】以降があればそこから採用
  const idx3 = t.indexOf("【3】");
  const idx4 = t.indexOf("【4】");
  if (idx3 >= 0) return t.slice(idx3).trim();
  if (idx4 >= 0) return t.slice(idx4).trim();
  return t;
}

/** 「目指すゴール（完了条件）」を抽出 */
function extractGoalsFromAI(raw: string): string[] {
  const t = (raw ?? "").trim();
  if (!t) return [];

  // 【3】があればそこから先をゴール領域として見る
  let area = t;
  const idx3 = t.indexOf("【3】");
  if (idx3 >= 0) area = t.slice(idx3);

  // ゴールの終わりは【4】があればそこまで
  const idx4 = area.indexOf("【4】");
  if (idx4 >= 0) area = area.slice(0, idx4);

  const lines = area
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const line of lines) {
    // 見出しっぽいのは除外
    if (line.startsWith("【")) continue;
    if (/^#/.test(line)) continue;

    // 箇条書きっぽい行だけ拾う
    const m = line.match(/^[-*・●]\s*(.+)$/);
    if (m?.[1]) {
      const g = m[1].trim();
      if (g) out.push(g);
      continue;
    }

    // 「- [ ]」形式も拾えるように（ただし後でToDo抽出では除外する）
    const m2 = line.match(/^- \[[ xX]\]\s*(.+)$/);
    if (m2?.[1]) {
      const g = m2[1].trim();
      if (g) out.push(g);
      continue;
    }
  }

  return out.slice(0, 6);
}

function normalizeCategoryName(raw: string): string {
  let t = (raw ?? "").trim();

  // 余計な装飾を軽く剥がす
  t = t.replace(/^カテゴリ(?:名)?[：:]\s*/i, "");
  t = t.replace(/^カテゴリー[：:]\s*/i, "");

  // 括弧に包まれてたら外す
  t = t.replace(/^\[(.+)\]$/, "$1");
  t = t.replace(/^【(.+)】$/, "$1");

  // 末尾コロンは削る
  t = t.replace(/[：:]+$/, "").trim();

  // 引用っぽいのを剥がす
  t = t.replace(/^["'「『](.+?)["'」』]$/, "$1").trim();

  return t || "未分類";
}

function isBadCategoryName(cat: string): boolean {
  const t = (cat ?? "").trim();
  if (!t) return true;

  // 章タイトルやメタっぽい単語はカテゴリとして扱わない
  const bad = ["分解", "ゴール", "完了条件", "入力", "出力", "進め方", "ルール", "チェック", "候補", "分析"];
  if (bad.some((b) => t.includes(b))) return true;

  // 長すぎるのもカテゴリとしては不自然（文章になってる可能性）
  if (t.length > 24) return true;

  return false;
}

function splitInlineCategoryFromText(raw: string): { category: string | null; text: string } {
  const t = (raw ?? "").trim();

  // 例）[準備] 〇〇 / 【準備】〇〇
  const m1 = t.match(/^\[(.+?)\]\s*(.+)$/);
  if (m1?.[1] && m1?.[2]) return { category: normalizeCategoryName(m1[1]), text: normalizeTodoText(m1[2]) };

  const m2 = t.match(/^【(.+?)】\s*(.+)$/);
  if (m2?.[1] && m2?.[2]) return { category: normalizeCategoryName(m2[1]), text: normalizeTodoText(m2[2]) };

  return { category: null, text: t };
}

/** フォールバック：カテゴリ無しでも「-」箇条書きだけ拾う */
function extractPlainBullets(raw: string): string[] {
  const t = (raw ?? "").trim();
  if (!t) return [];

  const lines = t.split("\n");
  const out: string[] = [];
  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) continue;
    if (line.startsWith("【")) continue;
    if (/^#/.test(line)) continue;
    if (/^- \[[ xX]\]/.test(line)) continue;

    const m = line.match(/^[-*・●]\s*(.+)$/);
    if (!m?.[1]) continue;

    const action = normalizeTodoText(m[1]);
    if (!action) continue;

    // 「カテゴリ:」みたいなのを誤爆で拾わない
    if (/^カテゴリ(?:名)?[：:]/.test(action) || /^カテゴリー[：:]/.test(action)) continue;

    out.push(action);
  }
  return out;
}

/** 【4. 分解】の候補を抽出（ゴールのチェック行などは拾わない） */
function extractActionCandidates(raw: string): Array<{ category: string; action: string }> {
  const t = (raw ?? "").trim();
  if (!t) return [];

  // ✅ 可能なら「【4】以降」だけを対象にする（ゴール混入を防ぐ）
  let area = t;
  const idx4 = t.indexOf("【4】");
  if (idx4 >= 0) area = t.slice(idx4);

  const rawLines = area.split("\n");

  const out: Array<{ category: string; action: string }> = [];
  let currentCat = "";

  const nextNonEmpty = (from: number) => {
    for (let j = from; j < rawLines.length; j++) {
      const ln = rawLines[j];
      if (ln && ln.trim()) return { raw: ln, idx: j };
    }
    return null;
  };

  for (let i = 0; i < rawLines.length; i++) {
    const lineRaw = rawLines[i] ?? "";
    const indent = lineRaw.length - lineRaw.trimStart().length;
    const line = lineRaw.trim();
    if (!line) continue;

    // 見出しっぽいのはスキップ
    if (line.startsWith("【")) continue;
    if (/^#/.test(line)) continue;

    // ✅ ゴールのチェック行っぽいのは ToDo候補から除外（保険）
    if (/^- \[[ xX]\]/.test(line)) continue;

    // 1) カテゴリ見出し（いろんな書き方に対応）
    const cat1 = line.match(/^\[(.+?)\]\s*$/);
    const cat2 = line.match(/^【(.+?)】\s*$/);
    const cat3 = line.match(/^(?:■|◆|▶|▷|▼|▽|★|☆)\s*(.+)$/);
    const cat4 = line.match(/^カテゴリ(?:名)?[：:]\s*(.+)$/i);
    const cat5 = line.match(/^カテゴリー[：:]\s*(.+)$/i);

    const cat = normalizeCategoryName(
      (cat1?.[1] ?? cat2?.[1] ?? cat4?.[1] ?? cat5?.[1] ?? cat3?.[1] ?? "").trim()
    );

    if ((cat1 || cat2 || cat3 || cat4 || cat5) && !isBadCategoryName(cat)) {
      currentCat = cat;
      continue;
    }

    // 2) 箇条書き
    const m = line.match(/^[-*・●]\s*(.+)$/);
    if (m?.[1]) {
      let payload = m[1].trim();

      // 「- [カテゴリ] タスク」形式
      const in1 = payload.match(/^\[(.+?)\]\s*(.+)$/);
      const in2 = payload.match(/^【(.+?)】\s*(.+)$/);
      if (in1?.[1] && in1?.[2]) {
        const c = normalizeCategoryName(in1[1]);
        const a = normalizeTodoText(in1[2]);
        if (a) out.push({ category: isBadCategoryName(c) ? currentCat || "未分類" : c, action: a });
        continue;
      }
      if (in2?.[1] && in2?.[2]) {
        const c = normalizeCategoryName(in2[1]);
        const a = normalizeTodoText(in2[2]);
        if (a) out.push({ category: isBadCategoryName(c) ? currentCat || "未分類" : c, action: a });
        continue;
      }

      // 「- 準備」→ 次の行がインデントされた箇条書きならカテゴリ見出し扱い
      const next = nextNonEmpty(i + 1);
      if (indent === 0 && next) {
        const nextIndent = next.raw.length - next.raw.trimStart().length;
        const nextLine = next.raw.trim();
        if (nextIndent > indent && /^[-*・●]\s+/.test(nextLine)) {
          const c = normalizeCategoryName(payload);
          if (!isBadCategoryName(c)) {
            currentCat = c;
            continue;
          }
        }
      }

      // 「準備: 〇〇」形式
      const colon = payload.match(/^(.+?)[：:]\s*(.+)$/);
      if (colon?.[1] && colon?.[2] && colon[1].trim().length <= 12) {
        const c = normalizeCategoryName(colon[1]);
        const a = normalizeTodoText(colon[2]);
        if (a) out.push({ category: isBadCategoryName(c) ? currentCat || "未分類" : c, action: a });
        continue;
      }

      const action = normalizeTodoText(payload);
      if (!action) continue;

      // カテゴリっぽい行を誤爆で ToDo にしない
      const possibleCat = normalizeCategoryName(action);
      if (!isBadCategoryName(possibleCat) && action === possibleCat && action.length <= 12) {
        // 次の行が箇条書きならカテゴリ扱い
        const n = nextNonEmpty(i + 1);
        if (n && /^[-*・●]\s+/.test(n.raw.trim())) {
          currentCat = possibleCat;
          continue;
        }
      }

      if (/^カテゴリ(?:名)?[：:]/.test(action) || /^カテゴリー[：:]/.test(action)) continue;

      out.push({ category: currentCat || "未分類", action });
      continue;
    }
  }

  return out;
}

/** AI結果をもとに、既存ToDoのカテゴリやテキストを軽く修復 */
function repairTodosFromAI(prevTodos: TodoItem[], aiText: string): TodoItem[] {
  const cands = extractActionCandidates(aiText);

  // action -> category（未分類以外だけ）
  const map = new Map<string, string>();
  for (const c of cands) {
    const a = normalizeTodoText(c.action);
    const cat = normalizeCategoryName(c.category);
    if (!a) continue;
    if (!isBadCategoryName(cat) && cat !== "未分類") {
      map.set(a, cat);
    }
  }

  let changed = false;

  const next = prevTodos.map((t) => {
    let nt = t;
    const inline = splitInlineCategoryFromText(nt.text);
    if (inline.category && inline.text !== nt.text) {
      changed = true;
      nt = { ...nt, text: inline.text };
      if (!nt.category || nt.category === "未分類") {
        nt = { ...nt, category: inline.category };
      }
    }

    const key = normalizeTodoText(nt.text);
    const mapped = map.get(key);

    if (mapped && (!nt.category || nt.category === "未分類")) {
      changed = true;
      nt = { ...nt, category: mapped };
    }

    return nt;
  });

  return changed ? next : prevTodos;
}

function goalsToMarkdown(goals: string[]) {
  return goals.map((g) => `- ${g}`).join("\n");
}

function todosToMarkdown(todos: TodoItem[], groups: GroupItem[]) {
  const groupTitle = new Map(groups.map((g) => [g.id, g.title]));
  return todos
    .map((it) => {
      const status = it.status ?? "normal";
      const st =
        status === "later" ? "（あとまわし）" : status === "unknown" ? "（わからない）" : "";
      const g = it.groupId ? `【${groupTitle.get(it.groupId) ?? "グループ"}】` : "";
      return `- [${it.done ? "x" : " "}] [${it.category || "未分類"}] ${g}${st}${it.text}`;
    })
    .join("\n");
}

/** バトンパス用プロンプト */
function buildIssuePrompt({
  listTitle,
  draft,
  goals,
  todos,
  groups,
  aiResult,
}: {
  listTitle: string;
  draft: string;
  goals: string[];
  todos: TodoItem[];
  groups: GroupItem[];
  aiResult: string;
}) {
  const goalBlock = goals.length ? `## ゴール\n${goalsToMarkdown(goals)}` : "";
  const todoBlock = todos.length ? `## ToDo\n${todosToMarkdown(todos, groups)}` : "";
  const draftBlock = draft.trim() ? `## 下書き\n${draft.trim()}` : "";
  const analysisBlock = aiResult.trim() ? `## AI分析（抜粋）\n${aiResult.trim()}` : "";

  const body = [goalBlock, todoBlock, draftBlock, analysisBlock].filter(Boolean).join("\n\n");

  return `# BaraBaraDo バトンパス（貼り付け専用）

あなたは「実行に強いToDo分解コーチ」。
ユーザーが BaraBaraDo で作った素材（ゴール/ToDo/下書き）を受け取って、**次に何をすれば進むか**を決めさせ、必要ならチェックリストをユーザーに合わせて改造して前に進める。

---

## 入力（BaraBaraDoからの引き継ぎ）
- タイトル: ${listTitle || "（無題）"}

${body}

---

## 進め方（ルール）
- 抽象論で終わらせない。必ず「行動」に落とす。
- 迷いがあるなら、次の1ステップを選ばせる（A/B）。
- ユーザーがしんどい前提があるので、最初は軽い着手で前進させる。
`;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T;
  if (!res.ok) throw new Error((data as any)?.text || res.statusText);
  return data;
}

export default function Page() {
  const router = useRouter();
  const params = useParams();

  const listId = useMemo(() => String((params as any)?.id ?? ""), [params]);

  const [list, setList] = useState<ListRow | null>(null);

  const [draft, setDraft] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [stage, setStage] = useState(0);
  const [archivedDone, setArchivedDone] = useState(0);

  const [busy, setBusy] = useState(false);
  const [busyTodoId, setBusyTodoId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const [toast, setToast] = useState<string>("");
  const toastTimer = useRef<number | null>(null);

  const [stageHistory, setStageHistory] = useState<StageSnapshot[]>([]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1600);
  }

  // 初期ロード：localStorage（ゲスト保存）
  useEffect(() => {
    if (!isBrowser()) return;
    if (!listId) return;

    const key = getLocalKey(listId);
    const metaKey = getLocalMetaKey(listId);

    const meta = safeJsonParse<{ title?: string; createdAt?: string; updatedAt?: string; isCompleted?: boolean; completedAt?: string | null }>(
      localStorage.getItem(metaKey) || "{}",
      {}
    );

    const saved = safeJsonParse<{
      draft?: string;
      goals?: string[];
      todos?: TodoItem[];
      groups?: GroupItem[];
      aiResult?: string;
      stage?: number;
      archivedDone?: number;
    }>(localStorage.getItem(key) || "{}", {});

    const title = meta.title || "List";
    const createdAt = meta.createdAt || nowIso();
    const updatedAt = meta.updatedAt || createdAt;

    setList({
      id: listId,
      title,
      createdAt,
      updatedAt,
      isCompleted: meta.isCompleted ?? false,
      completedAt: meta.completedAt ?? null,
    });

    setDraft(saved.draft || "");
    setGoals(Array.isArray(saved.goals) ? saved.goals : []);
    setTodos(Array.isArray(saved.todos) ? saved.todos : []);
    setGroups(Array.isArray(saved.groups) ? saved.groups : []);
    setAiResult(saved.aiResult || "");
    setStage(Number.isFinite(saved.stage as any) ? Number(saved.stage) : 0);
    setArchivedDone(Number.isFinite(saved.archivedDone as any) ? Number(saved.archivedDone) : 0);
  }, [listId]);

  // aiResult がある場合、カテゴリが「未分類」になってるToDoを軽く修復
  useEffect(() => {
    if (!aiResult.trim()) return;
    setTodos((prev) => repairTodosFromAI(prev, aiResult));
  }, [aiResult]);

  // localStorage 保存（debounce）
  useEffect(() => {
    if (!isBrowser()) return;
    if (!listId) return;
    if (!list) return;

    const key = getLocalKey(listId);
    const metaKey = getLocalMetaKey(listId);

    const t = window.setTimeout(() => {
      localStorage.setItem(
        key,
        JSON.stringify({
          draft,
          goals,
          todos,
          groups,
          aiResult,
          stage,
          archivedDone,
        })
      );
      localStorage.setItem(
        metaKey,
        JSON.stringify({
          title: list.title,
          createdAt: list.createdAt,
          updatedAt: nowIso(),
          isCompleted: list.isCompleted ?? false,
          completedAt: list.completedAt ?? null,
        })
      );
    }, 250);

    return () => {
      window.clearTimeout(t);
    };
  }, [listId, list, draft, goals, todos, groups, aiResult, stage, archivedDone]);

  // 進捗
  const totalTasks = todos.length;
  const doneTasks = todos.filter((t) => t.done).length;

  const expectedTotal = useMemo(() => {
    // 見込みTodo数：分析から拾える候補数 + 生成済み
    const l3Count = aiResult.trim() ? extractActionCandidates(aiResult).length : 0;
    const issued = todos.length;
    return Math.max(issued, l3Count);
  }, [aiResult, todos.length]);

  const issuedTotal = todos.length;
  const doneTotal = archivedDone + doneTasks;
  const parkedUnresolved = todos.filter((t) => t.status === "later" || t.status === "unknown").filter((t) => !t.done);
  const remainingExpected = Math.max(0, expectedTotal - doneTotal);

  const overallPct = expectedTotal ? Math.min(100, Math.round((doneTotal / expectedTotal) * 100)) : 0;

  function snapshotStage(label = "snapshot") {
    const snap: StageSnapshot = {
      id: uid("snap"),
      createdAt: Date.now(),
      label,
      draft,
      goals: [...goals],
      todos: JSON.parse(JSON.stringify(todos)),
      groups: JSON.parse(JSON.stringify(groups)),
      aiResult,
      stage,
      archivedDone,
    };
    setStageHistory((prev) => [snap, ...prev].slice(0, 10));
  }

  function restoreLatestSnapshot() {
    const latest = stageHistory[0];
    if (!latest) return;
    setDraft(latest.draft);
    setGoals(latest.goals);
    setTodos(latest.todos);
    setGroups(latest.groups);
    setAiResult(latest.aiResult);
    setStage(latest.stage);
    setArchivedDone(latest.archivedDone);
    setStageHistory((prev) => prev.slice(1));
    showToast("ひとつ前に戻した");
  }

  async function runAnalysis() {
    setError("");
    if (!draft.trim()) {
      setError("下書きを入れてね（雑でOK）");
      return;
    }

    snapshotStage("before-ai");

    setBusy(true);
    try {
      const res = await postJson<{ text: string }>("/api/ai/breakdown", { text: draft.trim() });

      const clean = sanitizeAnalysis(res.text || "");
      setAiResult(clean);

      // ゴール抽出
      const nextGoals = extractGoalsFromAI(clean);
      if (nextGoals.length) setGoals(nextGoals);

      // 最初の5つのToDoを作る（既存のToDoは消さない）
      const candidates = extractActionCandidates(clean);
      const first = candidates.slice(0, 5).map((x) => ({
        id: uid("todo"),
        text: normalizeTodoText(x.action),
        done: false,
        category: x.category || "未分類",
        status: "normal" as const,
        note: "",
      }));

      // 追加（重複は軽く避ける）
      const existingText = new Set(todos.map((t) => t.text));
      const add = first.filter((t) => t.text && !existingText.has(t.text));
      if (add.length) {
        setTodos((prev) => [...prev, ...add]);
        showToast("AIでゴールと最初のToDo5つを作った");
      } else {
        showToast("追加できるToDoがなかった");
      }

      setStage((s) => s + 1);
    } catch (e: any) {
      setError(`AIでエラー：${e?.message || "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  async function breakdownTodo(todoId: string) {
    setError("");
    const target = todos.find((t) => t.id === todoId);
    if (!target) return;

    if (target.done) {
      showToast("完了済みは分解しないよ（必要ならチェック外して）");
      return;
    }

    if (!target.text.trim()) return;

    snapshotStage("breakdown-todo");
    setBusyTodoId(todoId);

    try {
      const parentCat = target.category || "未分類";

      const goalsBlock = goals.length ? goals.map((g) => `- ${g}`).join("\n") : "（なし）";

      const existingTodosBlock = todos
        .filter((t) => t.id !== todoId)
        .slice(0, 30)
        .map((t) => `- ${t.text}`)
        .join("\n");

      const prompt = `あなたはToDo分解のアシスタント。\n次の「親タスク」を、今すぐ実行できる粒度の小タスクに分解して。\n\n【出力ルール】\n- 形式はこれだけ：\n  [カテゴリ名]\n  - タスク\n  - タスク\n- タスクは5〜8個\n- 1行1アクション。抽象語（検討する/頑張る等）は禁止。\n- 迷ったらカテゴリは「${parentCat}」にしてOK\n- 既存ToDoと重複するものは避ける\n\n【入力】\nリストタイトル: ${list?.title ?? ""}\nゴール:\n${goalsBlock}\n親タスク: ${target.text}\n追記: ${target.note || "（なし）"}\n既存ToDo（参考）:\n${existingTodosBlock || "（なし）"}\n`;

      const res = await postJson<{ text: string }>("/api/ai/breakdown", { text: prompt });
      const clean = sanitizeAnalysis(res.text || "");

      let candidates = extractActionCandidates(clean);
      if (!candidates.length) {
        const bullets = extractPlainBullets(clean);
        candidates = bullets.map((b) => ({ category: parentCat, action: b }));
      }

      const groupId = uid("grp");

      const toAdd: TodoItem[] = candidates
        .slice(0, 8)
        .map((c) => {
          const cat = c.category && c.category !== "未分類" ? c.category : parentCat;
          return {
            id: uid("todo"),
            text: normalizeTodoText(c.action),
            done: false,
            category: cat,
            status: "normal" as const,
            note: "",
            groupId,
          };
        })
        .filter((t) => t.text);

      if (!toAdd.length) {
        showToast("分解候補が取れなかった…");
        return;
      }

      setGroups((prev) => [...prev, { id: groupId, title: target.text }]);

      setTodos((prev) => {
        const idx = prev.findIndex((t) => t.id === todoId);
        if (idx < 0) return prev;

        const existing = new Set(prev.map((t) => t.text));
        const unique = toAdd.filter((t) => !existing.has(t.text));
        if (!unique.length) return prev;

        return [...prev.slice(0, idx + 1), ...unique, ...prev.slice(idx + 1)];
      });

      setStage((s) => s + 1);
      showToast("さらに分解した（下に追加した）");
    } catch (e: any) {
      const msg = `AIでエラー：${e?.message || "unknown"}`;
      setError(msg);
      showToast(msg);
    } finally {
      setBusyTodoId(null);
    }
  }

  function toggleDone(id: string) {
    snapshotStage("toggle-done");
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return { ...t, done: !t.done };
      })
    );
  }

  function removeTodo(id: string) {
    snapshotStage("remove-todo");
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  function setStatus(id: string, status: "normal" | "later" | "unknown") {
    snapshotStage("set-status");
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  }

  function updateNote(id: string, note: string) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, note } : t)));
  }

  async function copyText(s: string, msg = "コピーした") {
    try {
      await navigator.clipboard.writeText(s);
      showToast(msg);
    } catch {
      showToast("コピーできなかった…");
    }
  }

  const promptText = useMemo(() => {
    return buildIssuePrompt({
      listTitle: list?.title || "",
      draft,
      goals,
      todos,
      groups,
      aiResult,
    });
  }, [list?.title, draft, goals, todos, groups, aiResult]);

  if (!listId) {
    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.errorBox}>
            List ID が見つからないよ
            <div>
              <Link className={styles.linkBtn} href="/lists">
                Listsへ戻る
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <button className={styles.backBtn} onClick={() => router.push("/lists")} type="button">
            ← Lists
          </button>

          <div className={styles.headerRight}>
            <div className={styles.badges}>
              <span className={styles.badge}>🧸 ゲストモード</span>
              <span className={styles.badge}>🔒 この端末のブラウザに保存</span>
            </div>

            <nav className={styles.nav}>
              <Link className={styles.navLink} href="/help">
                Help
              </Link>
              <span className={styles.navSep}>·</span>
              <Link className={styles.navLink} href="/concept">
                Concept
              </Link>
            </nav>
          </div>
        </div>

        <h1 className={styles.pageTitle}>{list?.title ?? "List"}</h1>
        <p className={styles.subtitle}>下書き → ゴール → ToDo（分解/あとまわし）＋総進捗</p>
      </header>

      <div className={styles.container}>
        {/* 1) 下書き */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>1) 下書き（雑に放り込んでOK）</h2>
            <span className={styles.mini}>ここだけで分解できる</span>
          </div>

          <textarea
            className={styles.textarea}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="例）通帳だけ／家賃入金／控除／支出…など雑に"
          />

          <div className={styles.row}>
            <button className={styles.btnPrimary} onClick={runAnalysis} disabled={busy || busyTodoId !== null} type="button">
              {busy ? "分解中…" : "AIで分解する（ゴール→最初のToDo5つ）"}
            </button>

            <button
              className={styles.btnGhost}
              onClick={() => {
                snapshotStage();
                setDraft("");
                showToast("下書きをクリアした");
              }}
              type="button"
            >
              下書きクリア
            </button>

            {stageHistory.length > 0 && (
              <button className={styles.btnGhost} onClick={restoreLatestSnapshot} type="button">
                ひとつ前に戻す
              </button>
            )}
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </section>

        {/* 2) ゴール */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>2) 目指すゴール（完了条件）</h2>
            <span className={styles.mini}>完了条件＝ゴール</span>
          </div>

          {goals.length > 0 ? (
            <div className={styles.goalBox}>
              {goals.map((g, i) => (
                <div key={`${g}_${i}`} className={styles.goalLine}>
                  <span className={styles.goalBullet}>●</span>
                  <span className={styles.goalText}>{g}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.pMuted}>（まだゴールがないよ。AIで分解すると自動で入る）</p>
          )}

          <div className={styles.row}>
            <button className={styles.btnGhost} onClick={() => copyText(goalsToMarkdown(goals), "ゴールをコピーした")} type="button">
              ゴールをコピー（Markdown）
            </button>
          </div>
        </section>

        {/* 3) ToDo */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>3) ToDo（分解で増える）</h2>
            <span className={styles.mini}>Stage {stage || 0}</span>
          </div>

          {/* 総進捗 */}
          <div className={styles.overallRow}>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>見込みTodo数</div>
              <div className={styles.kpiValue}>{expectedTotal}</div>
              <div className={styles.kpiHint}>（分析候補={aiResult.trim() ? extractActionCandidates(aiResult).length : 0} / 生成済み={issuedTotal}）</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>累計完了</div>
              <div className={styles.kpiValue}>{doneTotal}</div>
              <div className={styles.kpiHint}>（過去={archivedDone} / 現在={doneTasks}）</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>累計残り（見込み）</div>
              <div className={styles.kpiValue}>{remainingExpected}</div>
              <div className={styles.kpiHint}>保留={parkedUnresolved.length}</div>
            </div>
            <div className={styles.kpiWide}>
              <div className={styles.kpiLabel}>総進捗</div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${overallPct}%` }} />
              </div>
              <div className={styles.kpiHint}>{overallPct}%</div>
            </div>
          </div>

          <div className={styles.itemList}>
            {todos.length > 0 ? (
              todos.map((it) => {
                const status = it.status ?? "normal";
                const isGroup = Boolean(it.groupId);

                const statusPill =
                  status === "unknown"
                    ? styles.statusUnknown
                    : status === "later"
                    ? styles.statusLater
                    : "";

                const actionBtnCls =
                  status === "later" ? styles.btnMiniRevive : styles.btnMiniLater;

                return (
                  <div
                    key={it.id}
                    className={`${styles.itemRow} ${isGroup ? styles.groupRow : ""} ${statusPill}`}
                  >
                    <div className={styles.itemLeft}>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={it.done}
                        onChange={() => toggleDone(it.id)}
                      />

                      <span className={styles.cat}>[{it.category || "未分類"}]</span>

                      <span className={it.done ? styles.todoTextDone : styles.todoText}>
                        {it.text}
                      </span>

                      {status === "later" && <span className={styles.tagLater}>あとまわし</span>}
                    </div>

                    <div className={styles.itemRight}>
                      {/* 追記 */}
                      <input
                        className={styles.noteInput}
                        value={it.note || ""}
                        onChange={(e) => updateNote(it.id, e.target.value)}
                        placeholder="追記（任意）"
                      />

                      {/* あとまわし/復帰 */}
                      <button
                        className={actionBtnCls}
                        type="button"
                        onClick={() =>
                          setStatus(it.id, status === "later" ? "normal" : "later")
                        }
                      >
                        {status === "later" ? "戻す" : "あとまわし"}
                      </button>

                      {/* さらに分解（AI） */}
                      <button
                        className={styles.btnMiniPrimary}
                        type="button"
                        disabled={busy || busyTodoId !== null}
                        onClick={() => breakdownTodo(it.id)}
                      >
                        {busyTodoId === it.id ? "分解中…" : "さらに分解"}
                      </button>

                      <button className={styles.btnDanger} onClick={() => removeTodo(it.id)} type="button">
                        削除
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className={styles.pMuted}>（まだToDoがないよ。上のボタンでAI分解してみて）</p>
            )}
          </div>
        </section>

        {/* 4) プロンプト発行 */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>4) プロンプト発行（他AIへバトンパス）</h2>
            <span className={styles.mini}>デフォはゴール＋ToDoだけ</span>
          </div>

          <pre className={styles.pre}>{promptText}</pre>

          <div className={styles.row}>
            <button className={styles.btnPrimary} onClick={() => copyText(promptText, "プロンプトをコピーした")} type="button">
              プロンプトをコピー
            </button>
          </div>
        </section>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </main>
  );
}
