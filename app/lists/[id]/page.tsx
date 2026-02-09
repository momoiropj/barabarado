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
};

type ItemStatus = "normal" | "unknown" | "later";

type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  category: string;
  createdAt?: string;

  type?: "task" | "group";
  depth?: number;
  status?: ItemStatus;
};

type ParkedResolution = "returned" | "done" | "deleted" | "cleared";

type ParkedItem = {
  key: string;
  text: string;
  category: string;
  status: "unknown" | "later";
  stage: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolution?: ParkedResolution;
};

type StageSnapshot = {
  stage: number;
  createdAt: string;

  items: ChecklistItem[];
  goals: string[];
  aiResult: string;
  draft: string;

  archivedCreated: number;
  archivedDone: number;

  parked: ParkedItem[];

  usedActionKeys: string[];
  issuedPrompt: string;
};

type SavedDetail = {
  draft: string;
  aiResult: string;
  goals: string[];

  checklist: ChecklistItem[];
  stage: number;

  usedActionKeys: string[];
  stageHistory: StageSnapshot[];
  issuedPrompt: string;

  archivedCreated: number;
  archivedDone: number;

  parked: ParkedItem[];

  updatedAt: string;
};

const GUEST_LISTS_KEY = "bbdo_guest_lists_v1";
const DETAIL_KEY_PREFIX = "bbdo_guest_list_detail_v1:";

function uid(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function loadGuestLists(): ListRow[] {
  const parsed = safeParseJSON<unknown>(localStorage.getItem(GUEST_LISTS_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((x: any) => ({
      id: String(x?.id ?? ""),
      title: String(x?.title ?? ""),
      createdAt: String(x?.createdAt ?? ""),
      updatedAt: String(x?.updatedAt ?? ""),
    }))
    .filter((x) => x.id && x.title);
}

function normalizeLine(s: string) {
  return s
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[-*•]\s+/, "")
    .trim();
}

function uniquePush(arr: string[], v: string) {
  const key = v.toLowerCase();
  if (arr.some((x) => x.toLowerCase() === key)) return;
  arr.push(v);
}

function normalizeTodoText(input: string): string {
  let s = normalizeLine(input);
  s = s.replace(/[。．]$/, "").trim();
  if (!s) return "";

  // 丁寧語→常体（最低限）
  if (s.endsWith("します")) s = s.replace(/します$/, "する");

  // 「〜るする」などの変な語尾を潰す
  s = s.replace(/(る|う|く|ぐ|す|つ|ぬ|ぶ|む)\s*する$/, "$1");
  s = s.replace(/する\s*する$/, "する");

  return s.trim();
}

function itemKey(text: string, category: string) {
  return `${normalizeLine(category)}||${normalizeLine(text)}`.toLowerCase();
}

function loadDetail(listId: string): SavedDetail {
  const key = `${DETAIL_KEY_PREFIX}${listId}`;
  const parsed = safeParseJSON<Partial<SavedDetail>>(localStorage.getItem(key));
    const now = new Date().toISOString();

  // localStorage の古い/壊れたデータを読み込んでも落ちないように正規化
  const normalizeChecklist = (arr: any[] | undefined): ChecklistItem[] => {
    if (!Array.isArray(arr)) return [];

    return arr
      .map((x: any): ChecklistItem => {
        const depthNum = Number(x?.depth);
        const createdAt = typeof x?.createdAt === "string" ? x.createdAt : undefined;

        const type: ChecklistItem["type"] = x?.type === "group" ? "group" : "task";

        const status: ChecklistItem["status"] =
          x?.status === "unknown" ? "unknown" : x?.status === "later" ? "later" : "normal";

        return {
          id: String(x?.id ?? uid()),
          text: String(x?.text ?? ""),
          done: Boolean(x?.done ?? false),
          category: String(x?.category ?? "未分類"),
          createdAt,
          type,
          depth: Number.isFinite(depthNum) ? depthNum : 0,
          status,
        };
      })
      .filter((x) => x.text);
  };

  const normalizeParked = (arr: any[] | undefined): ParkedItem[] => {
    if (!Array.isArray(arr)) return [];

    return arr
      .map((p: any): ParkedItem => {
        const status: ParkedItem["status"] = p?.status === "unknown" ? "unknown" : "later";

        const resolution: ParkedItem["resolution"] =
          p?.resolution === "returned"
            ? "returned"
            : p?.resolution === "done"
              ? "done"
              : p?.resolution === "deleted"
                ? "deleted"
                : p?.resolution === "cleared"
                  ? "cleared"
                  : undefined;

        return {
          key: String(p?.key ?? "").toLowerCase(),
          text: String(p?.text ?? ""),
          category: String(p?.category ?? "未分類"),
          status,
          stage: Number(p?.stage ?? 0),
          createdAt: typeof p?.createdAt === "string" ? p.createdAt : now,
          updatedAt: typeof p?.updatedAt === "string" ? p.updatedAt : now,
          resolvedAt: typeof p?.resolvedAt === "string" ? p.resolvedAt : undefined,
          resolution,
        };
      })
      .filter((p) => p.key && p.text);
  };

  const stageHistory: StageSnapshot[] = Array.isArray((parsed as any)?.stageHistory)
    ? ((parsed as any).stageHistory as any[])
        .map((h: any): StageSnapshot => ({
          stage: Number(h?.stage ?? 0),
          createdAt: String(h?.createdAt ?? now),
          items: normalizeChecklist(h?.items),
          goals: Array.isArray(h?.goals) ? h.goals.map((g: any) => String(g)) : [],
          aiResult: String(h?.aiResult ?? ""),
          draft: String(h?.draft ?? ""),
          archivedCreated: Number(h?.archivedCreated ?? 0),
          archivedDone: Number(h?.archivedDone ?? 0),
          parked: normalizeParked(h?.parked),
          usedActionKeys: Array.isArray(h?.usedActionKeys) ? h.usedActionKeys.map((x: any) => String(x)) : [],
          issuedPrompt: String(h?.issuedPrompt ?? ""),
        }))
        .filter((h) => h.stage >= 0 && Boolean(h.createdAt))
    : [];


  return {
    draft: String((parsed as any)?.draft ?? ""),
    aiResult: String((parsed as any)?.aiResult ?? ""),
    goals: Array.isArray((parsed as any)?.goals) ? (parsed as any).goals.map((g: any) => String(g)) : [],
    checklist: normalizeChecklist((parsed as any)?.checklist),
    stage: Number((parsed as any)?.stage ?? 0),
    usedActionKeys: Array.isArray((parsed as any)?.usedActionKeys)
      ? ((parsed as any).usedActionKeys as any[]).map((x) => String(x))
      : [],
    stageHistory,
    issuedPrompt: String((parsed as any)?.issuedPrompt ?? ""),
    archivedCreated: Number((parsed as any)?.archivedCreated ?? 0),
    archivedDone: Number((parsed as any)?.archivedDone ?? 0),
    parked: normalizeParked((parsed as any)?.parked),
    updatedAt: String((parsed as any)?.updatedAt ?? now),
  };
}

function saveDetail(listId: string, detail: SavedDetail) {
  const key = `${DETAIL_KEY_PREFIX}${listId}`;
  localStorage.setItem(key, JSON.stringify(detail));
}

/** 分析から「余計なメタ情報（【1】【2】）」が混ざっても、3/4だけ残す */
function sanitizeAnalysis(raw: string): string {
  const text = raw.trim();
  if (!text) return "";

  const idx3 = text.search(/【\s*3[\.\s]*完了条件/);
  const idx4 = text.search(/【\s*4[\.\s]*分解/);

  if (idx3 >= 0) return text.slice(idx3).trim();
  if (idx4 >= 0) return text.slice(idx4).trim();
  return text;
}

/** 完了条件（目指すゴール）を抜く */
function extractGoalsFromCompletion(text: string): string[] {
  const lines = text.split("\n");
  const goals: string[] = [];
  let inSection = false;

  for (const raw of lines) {
    const ln = raw.trim();

    if (ln.includes("完了条件") && ln.startsWith("【")) {
      inSection = true;
      continue;
    }
    if (inSection && ln.startsWith("【") && !ln.includes("完了条件")) break;
    if (!inSection) continue;

    const m = ln.match(/^-+\s*\[\s*[xX ]?\s*\]\s*(.+)$/);
    if (m?.[1]) {
      const t = normalizeLine(m[1]);
      if (!t) continue;
      if (t.includes("？") || t.includes("?")) continue;
      uniquePush(goals, t);
    }
  }

  if (goals.length === 0) {
    for (const raw of lines) {
      const ln = raw.trim();
      const m = ln.match(/^-+\s*\[\s*[xX ]?\s*\]\s*(.+)$/);
      if (m?.[1]) {
        const t = normalizeLine(m[1]);
        if (!t) continue;
        if (t.includes("？") || t.includes("?")) continue;
        uniquePush(goals, t);
        if (goals.length >= 5) break;
      }
    }
  }

  return goals;
}

function extractActionCandidates(text: string): { category: string; action: string }[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const out: { category: string; action: string }[] = [];
  let currentL1 = "未分類";

  const push = (cat: string, actRaw: string) => {
    const act = normalizeTodoText(normalizeLine(actRaw));
    if (!act) return;
    if (act.includes("？") || act.includes("?")) return;

    const key = (cat + "||" + act).toLowerCase();
    if (out.some((x) => (x.category + "||" + x.action).toLowerCase() === key)) return;
    out.push({ category: cat || "未分類", action: act });
  };

  for (const raw of lines) {
    const line = raw.replace(/^[-*•]\s*/, "");

    // "[カテゴリ] タスクする" 形式も拾う（L1が崩れてもカテゴリを残す）
    const bracket = line.match(/^\[([^\]]+)\]\s*(.+)$/);
    if (bracket?.[1] && bracket?.[2]) {
      push(normalizeLine(bracket[1]), bracket[2]);
      continue;
    }

    const m1 = line.match(/^L1[:：]\s*(.+)$/);
    if (m1?.[1]) {
      currentL1 = normalizeLine(m1[1]) || "未分類";
      continue;
    }

    const m3 = line.match(/^L3[:：]\s*(.+)$/);
    if (m3?.[1]) {
      push(currentL1, m3[1]);
      continue;
    }

// L3が無い出力でも拾う（箇条書きの「〜する」縛りはやめる）
if (line.startsWith("【")) continue;
if (/^L[12][:：]/.test(line)) continue;

if (
  /(する|します|した)$/.test(line) ||
  /(る|う|く|ぐ|す|つ|ぬ|ぶ|む)$/.test(line) ||
  /できる$/.test(line)
) {
  push(currentL1, line);
}
  }

  return out;
}

/** 内容に合わせたフォールバック（「関係ない固定5個」をやめる） */
function contentAwareFallback(cleaned: string): { category: string; action: string }[] {
  const lower = cleaned.toLowerCase();

  const looksTax =
    lower.includes("確定申告") ||
    lower.includes("不動産") ||
    lower.includes("家賃") ||
    lower.includes("固定資産税") ||
    lower.includes("減価償却") ||
    lower.includes("e-tax") ||
    lower.includes("収支内訳");

  if (looksTax) {
    return [
      { category: "通帳", action: "入金（家賃）を月別に一覧化する" },
      { category: "経費", action: "管理費・引落・控除の実態を通帳で確認する" },
      { category: "経費", action: "固定資産税や保険など追加経費の有無を確認する" },
      { category: "申告", action: "申告期限と提出方法（e-Tax/書面）を確認する" },
      { category: "申告", action: "不動産所得の収支内訳を作成する" },
    ].map((x) => ({ ...x, action: normalizeTodoText(x.action) }));
  }

  return [
  { category: "目的", action: "ゴール（完了条件）を3つ書く" },
  { category: "目的", action: "期限（いつまでに）を決める" },
  { category: "予算感", action: "上限予算を決める（仮でOK）" },
  { category: "準備", action: "必要な材料・情報を洗い出す" },
  { category: "段取り", action: "作業の順番をざっくり並べる" },
].map((x) => ({ ...x, action: normalizeTodoText(x.action) }));
}

/** 最初のToDo5つを作る：カテゴリ分散で拾う / 抽出失敗なら内容に合わせたフォールバック */
function pickInitial5FromAnalysis(aiRaw: string): ChecklistItem[] {
  const cleaned = sanitizeAnalysis(aiRaw);
  const cands = extractActionCandidates(cleaned);

  const picked: { category: string; action: string }[] = [];
  const used = new Set<string>();

  // まずカテゴリ分散で拾う
  for (const c of cands) {
    const k = c.action.toLowerCase();
    if (used.has(k)) continue;
    if (picked.some((p) => p.category.toLowerCase() === c.category.toLowerCase())) continue;
    picked.push(c);
    used.add(k);
    if (picked.length >= 5) break;
  }

  // 足りない分は残りから
  for (const c of cands) {
    if (picked.length >= 5) break;
    const k = c.action.toLowerCase();
    if (used.has(k)) continue;
    picked.push(c);
    used.add(k);
  }

  const base = picked.length > 0 ? picked.slice(0, 5) : contentAwareFallback(cleaned).slice(0, 5);

  return base.map((p) => ({
    id: uid(),
    text: normalizeTodoText(p.action),
    done: false,
    category: p.category || "未分類",
    createdAt: new Date().toISOString(),
    type: "task",
    depth: 0,
    status: "normal",
  }));
}

function goalsToMarkdown(goals: string[]) {
  if (goals.length === 0) return "- （まだゴールがないよ）";
  return goals.map((g) => `- ${g}`).join("\n");
}

function checklistToMarkdown(items: ChecklistItem[]) {
  const tasks = items.filter((x) => (x.type ?? "task") === "task");
  if (tasks.length === 0) return "- [ ] （まだToDoがないよ）";
  return tasks
    .map((it) => {
      const st =
        it.status && it.status !== "normal"
          ? `(${it.status === "unknown" ? "わからない" : "あとまわし"}) `
          : "";
      return `- [${it.done ? "x" : " "}] [${it.category || "未分類"}] ${st}${it.text}`;
    })
    .join("\n");
}

/** バトンパス用プロンプト */
function buildBatonPassPrompt(args: {
  draft: string;
  aiResult: string;
  goals: string[];
  checklist: ChecklistItem[];
  stage: number;
  includeDraft: boolean;
  includeAnalysis: boolean;
}): string {
  const { draft, aiResult, goals, checklist, stage, includeDraft, includeAnalysis } = args;

  const goalBlock = `## 目指すゴール（完了条件）\n\n\`\`\`markdown\n${goalsToMarkdown(goals)}\n\`\`\``;
  const todoBlock = `## 現在のToDo（Stage ${stage || 0}）\n\n\`\`\`markdown\n${checklistToMarkdown(checklist)}\n\`\`\``;

  const draftBlock = includeDraft
    ? draft.trim()
      ? `## 下書き（参考）\n\n\`\`\`markdown\n${draft.trim()}\n\`\`\``
      : `## 下書き（参考）\n\n（なし）`
    : "";

  const analysisBlock = includeAnalysis
    ? aiResult.trim()
      ? `## 分析（構造文法・参考）\n\n\`\`\`markdown\n${aiResult.trim()}\n\`\`\``
      : `## 分析（構造文法・参考）\n\n（なし）`
    : "";

  const body = [goalBlock, todoBlock, draftBlock, analysisBlock].filter(Boolean).join("\n\n");

  return [
    `# BarabaraDo → Baton Pass`,
    ``,
    `あなたは「実行に強い伴走AI」。ユーザーのゴール達成のために、ToDoを具体化して進行管理する。`,
    ``,
    `## あなたの最初の返答（必須・この1行で開始）`,
    `OK，BarabaraDoからバトンパスされたよ！ここからは私がサポートするよ`,
    ``,
    `## ルール`,
    `- 抽象論で終わらせない。必ず「行動」に落とす`,
    `- まず「今日このあと15分で終わる Next Action」を3つ出す`,
    `- 次に、ToDoを “より小さく、詰まりにくく” 改造する`,
    `- 質問は最大2つ（質問前に仮案を出す）`,
    ``,
    body,
  ].join("\n");
}

/** indexのアイテム + 子孫をまとめて削除 */
function removeWithDescendants(items: ChecklistItem[], index: number): { next: ChecklistItem[]; removed: ChecklistItem[] } {
  const parentDepth = items[index]?.depth ?? 0;
  let end = index + 1;
  while (end < items.length) {
    const d = items[end]?.depth ?? 0;
    if (d <= parentDepth) break;
    end++;
  }
  const removed = items.slice(index, end);
  const next = items.slice(0, index).concat(items.slice(end));
  return { next, removed };
}

/** indexのアイテム + 子孫を、同じ親スコープの末尾へ移動（あとまわし用） */
function moveBlockToParentEnd(items: ChecklistItem[], index: number): ChecklistItem[] {
  const depth = items[index]?.depth ?? 0;

  let blockEnd = index + 1;
  while (blockEnd < items.length) {
    const d = items[blockEnd]?.depth ?? 0;
    if (d <= depth) break;
    blockEnd++;
  }

  let scopeEnd = blockEnd;
  while (scopeEnd < items.length) {
    const d = items[scopeEnd]?.depth ?? 0;
    if (d < depth) break;
    scopeEnd++;
  }

  if (scopeEnd === blockEnd) return items;

  const before = items.slice(0, index);
  const block = items.slice(index, blockEnd);
  const middle = items.slice(blockEnd, scopeEnd);
  const after = items.slice(scopeEnd);

  return before.concat(middle, block, after);
}

/** 箇条書き/行からサブToDo候補を抜く */
function extractSubTasks(text: string): string[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];

  for (const ln of lines) {
    const m1 = ln.match(/^[-*•]\s+(.+)$/);
    if (m1?.[1]) {
      const t = normalizeLine(m1[1]);
      if (!t) continue;
      if (t.includes("？") || t.includes("?")) continue;
      uniquePush(out, normalizeTodoText(t));
      continue;
    }

    const m3 = ln.match(/^L3[:：]\s*(.+)$/);
    if (m3?.[1]) {
      const t = normalizeLine(m3[1]);
      if (!t) continue;
      if (t.includes("？") || t.includes("?")) continue;
      uniquePush(out, normalizeTodoText(t));
      continue;
    }
  }

  if (out.length === 0) {
    for (const ln of lines) {
      const t = normalizeLine(ln.replace(/^[-*•]/, ""));
      if (!t) continue;
      if (t.length < 3) continue;
      if (t.includes("？") || t.includes("?")) continue;
      uniquePush(out, normalizeTodoText(t));
      if (out.length >= 7) break;
    }
  }

  return out.slice(0, 7);
}

export default function Page() {
  const router = useRouter();
  const params = useParams();

  const listId = useMemo(() => {
    const raw = (params as any)?.id;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) return String(raw[0] ?? "");
    return "";
  }, [params]);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  };

  const [list, setList] = useState<ListRow | null>(null);

  const [draft, setDraft] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [goals, setGoals] = useState<string[]>([]);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newTodoText, setNewTodoText] = useState("");
  const [newTodoCategory, setNewTodoCategory] = useState("");

  const [stage, setStage] = useState<number>(0);
  const [usedActionKeys, setUsedActionKeys] = useState<string[]>([]);
  const [stageHistory, setStageHistory] = useState<StageSnapshot[]>([]);

  const [issuedPrompt, setIssuedPrompt] = useState("");
  const issuedPromptRef = useRef<HTMLTextAreaElement | null>(null);

  const [includeDraftInPrompt, setIncludeDraftInPrompt] = useState(false);
  const [includeAnalysisInPrompt, setIncludeAnalysisInPrompt] = useState(false);

  const [archivedCreated, setArchivedCreated] = useState<number>(0);
  const [archivedDone, setArchivedDone] = useState<number>(0);

  const [parked, setParked] = useState<ParkedItem[]>([]);
  const [parkingOpen, setParkingOpen] = useState<boolean>(true);

  const [busy, setBusy] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!listId) return;

    const lists = loadGuestLists();
    const found = lists.find((x) => x.id === listId) ?? null;
    setList(found);

    const d = loadDetail(listId);
    setDraft(d.draft);
    setAiResult(d.aiResult);
    setGoals(d.goals ?? []);
    setChecklist(d.checklist ?? []);
    setStage(d.stage ?? 0);
    setUsedActionKeys(d.usedActionKeys ?? []);
    setStageHistory(d.stageHistory ?? []);
    setIssuedPrompt(d.issuedPrompt ?? "");

    setArchivedCreated(d.archivedCreated ?? 0);
    setArchivedDone(d.archivedDone ?? 0);
    setParked(d.parked ?? []);
  }, [listId]);

  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!listId) return;

    const payload: SavedDetail = {
      draft,
      aiResult,
      goals,
      checklist,
      stage,
      usedActionKeys,
      stageHistory,
      issuedPrompt,
      archivedCreated,
      archivedDone,
      parked,
      updatedAt: new Date().toISOString(),
    };

    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        saveDetail(listId, payload);
      } catch {}
    }, 250);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [
    listId,
    draft,
    aiResult,
    goals,
    checklist,
    stage,
    usedActionKeys,
    stageHistory,
    issuedPrompt,
    archivedCreated,
    archivedDone,
    parked,
  ]);

  const copyText = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(okMsg);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast(okMsg);
    }
  };

  const snapshotStage = () => {
    const snap: StageSnapshot = {
      stage: stage || 0,
      createdAt: new Date().toISOString(),
      items: checklist,
      goals,
      aiResult,
      draft,
      archivedCreated,
      archivedDone,
      parked,
      usedActionKeys,
      issuedPrompt,
    };
    setStageHistory([snap, ...stageHistory].slice(0, 20));
  };

  const restoreLatestSnapshot = () => {
    const latest = stageHistory[0];
    if (!latest) return;

    setChecklist(latest.items);
    setGoals(latest.goals);
    setAiResult(latest.aiResult);
    setDraft(latest.draft);

    setStage(latest.stage);
    setArchivedCreated(latest.archivedCreated);
    setArchivedDone(latest.archivedDone);
    setParked(latest.parked);

    setUsedActionKeys(latest.usedActionKeys);
    setIssuedPrompt(latest.issuedPrompt);

    setStageHistory(stageHistory.slice(1));
    showToast("ひとつ前の状態に戻した");
  };

  const addManualTodo = () => {
    const text = newTodoText.trim();
    if (!text) {
      showToast("ToDoが空だよ");
      return;
    }
    const category = newTodoCategory.trim() || "未分類";

    snapshotStage();

    const item: ChecklistItem = {
      id: uid(),
      text,
      done: false,
      category,
      createdAt: new Date().toISOString(),
      type: "task",
      depth: 0,
      status: "normal",
    };

    setChecklist((prev) => [...prev, item]);
    setUsedActionKeys((prev) => (prev.includes(text) ? prev : [...prev, text]));
    setStage((v) => v || 1);

    setNewTodoText("");
    setNewTodoCategory("");
    showToast("ToDoを追加した");
  };

  const taskItems = useMemo(() => checklist.filter((x) => (x.type ?? "task") === "task"), [checklist]);
  const totalTasks = taskItems.length;
  const doneTasks = taskItems.filter((x) => x.done).length;
  const remainingTasks = totalTasks - doneTasks;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const canGenerateNextStage = doneTasks >= 3 || remainingTasks <= 2;

  // 見込みTodo数：分析から拾える候補数
  const l3Count = useMemo(() => {
    if (!aiResult.trim()) return 0;
    const cleaned = sanitizeAnalysis(aiResult);
    return extractActionCandidates(cleaned).length;
  }, [aiResult]);

  // ✅ 次の候補「残り件数」（未使用の候補）
  const nextCandidateRemaining = useMemo(() => {
    if (!aiResult.trim()) return 0;
    const cleaned = sanitizeAnalysis(aiResult);
    const cands = extractActionCandidates(cleaned);

    const used = new Set(usedActionKeys.map((x) => x.toLowerCase()));
    const seen = new Set<string>();
    let count = 0;

    for (const c of cands) {
      const k = c.action.toLowerCase();
      if (used.has(k)) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      count++;
    }
    return count;
  }, [aiResult, usedActionKeys]);

  const hasNextCandidates = nextCandidateRemaining > 0;

  // 総進捗
  const issuedTotal = archivedCreated + totalTasks;
  const expectedTotal = Math.max(l3Count, issuedTotal);
  const doneTotal = archivedDone + doneTasks;
  const remainingExpected = Math.max(expectedTotal - doneTotal, 0);
  const overallPct = expectedTotal > 0 ? Math.round((doneTotal / expectedTotal) * 100) : 0;

  const parkedUnresolved = parked.filter((p) => !p.resolvedAt);
  const parkedResolved = parked.filter((p) => p.resolvedAt);

  const upsertParked = (it: ChecklistItem, status: "unknown" | "later") => {
    const key = itemKey(it.text, it.category);
    const now = new Date().toISOString();
    setParked((prev) => {
      const idx = prev.findIndex((p) => p.key === key);
      if (idx < 0) {
        const next: ParkedItem = {
          key,
          text: it.text,
          category: it.category || "未分類",
          status,
          stage: stage || 0,
          createdAt: now,
          updatedAt: now,
        };
        return [next, ...prev];
      }
      const cur = prev[idx];
      const next = [...prev];
      next[idx] = {
        ...cur,
        text: it.text,
        category: it.category || "未分類",
        status,
        stage: cur.stage || stage || 0,
        updatedAt: now,
        resolvedAt: undefined,
        resolution: undefined,
      };
      return next;
    });
  };

  const resolveParked = (it: ChecklistItem, resolution: ParkedResolution) => {
    const key = itemKey(it.text, it.category);
    const now = new Date().toISOString();
    setParked((prev) => {
      const idx = prev.findIndex((p) => p.key === key);
      if (idx < 0) return prev;
      const cur = prev[idx];
      if (cur.resolvedAt) return prev;
      const next = [...prev];
      next[idx] = { ...cur, updatedAt: now, resolvedAt: now, resolution };
      return next;
    });
  };

  const resolveParkedByKey = (key: string, resolution: ParkedResolution) => {
    const now = new Date().toISOString();
    setParked((prev) => {
      const idx = prev.findIndex((p) => p.key === key);
      if (idx < 0) return prev;
      const cur = prev[idx];
      if (cur.resolvedAt) return prev;
      const next = [...prev];
      next[idx] = { ...cur, updatedAt: now, resolvedAt: now, resolution };
      return next;
    });
  };

  const reopenIfDoneResolved = (it: ChecklistItem) => {
    const key = itemKey(it.text, it.category);
    const now = new Date().toISOString();
    setParked((prev) => {
      const idx = prev.findIndex((p) => p.key === key);
      if (idx < 0) return prev;
      const cur = prev[idx];
      if (cur.resolution !== "done") return prev;
      const next = [...prev];
      next[idx] = { ...cur, updatedAt: now, resolvedAt: undefined, resolution: undefined };
      return next;
    });
  };

  const toggleItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        if ((x.type ?? "task") === "group") return x;

        const nextDone = !x.done;

        if (nextDone) resolveParked(x, "done");
        else reopenIfDoneResolved(x);

        return { ...x, done: nextDone };
      })
    );
  };

  const deleteItem = (id: string) => {
    snapshotStage();
    setChecklist((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx < 0) return prev;

      const { next, removed } = removeWithDescendants(prev, idx);

      for (const r of removed) {
        if ((r.type ?? "task") !== "task") continue;
        resolveParked(r, "deleted");
      }

      return next;
    });
    showToast("削除した");
  };

  const setUnknown = (id: string) => {
    setChecklist((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        if ((x.type ?? "task") === "group") return x;

        const nextStatus: ItemStatus = x.status === "unknown" ? "normal" : "unknown";
        const next: ChecklistItem = { ...x, status: nextStatus, done: nextStatus === "unknown" ? false : x.done };

        if (nextStatus === "unknown") upsertParked(next, "unknown");
        else resolveParked(next, "cleared");

        return next;
      })
    );
    showToast("「わからない」を切り替えた");
  };

  const setLater = (id: string) => {
    setChecklist((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx < 0) return prev;
      const it = prev[idx];
      if ((it.type ?? "task") === "group") return prev;

      const toLater = it.status !== "later";
      const updated = [...prev];
      const nextStatus: ItemStatus = toLater ? "later" : "normal";
      const nextItem: ChecklistItem = { ...it, status: nextStatus, done: false };
      updated[idx] = nextItem;

      if (toLater) {
        upsertParked(nextItem, "later");
        return moveBlockToParentEnd(updated, idx);
      } else {
        resolveParked(nextItem, "cleared");
        return updated;
      }
    });
    showToast("「あとまわし」を切り替えた");
  };

  // ✅ 保留ボード → このStageに復帰
  const reviveParkedToStage = (p: ParkedItem) => {
    snapshotStage();

    const exists = checklist.some((x) => itemKey(x.text, x.category) === p.key);
    if (!exists) {
      const newItem: ChecklistItem = {
        id: uid(),
        text: normalizeTodoText(p.text),
        done: false,
        category: p.category || "未分類",
        createdAt: new Date().toISOString(),
        type: "task",
        depth: 0,
        status: "normal",
      };
      setChecklist((prev) => [newItem, ...prev]);
      setUsedActionKeys((prev) => {
        const next = [...prev];
        uniquePush(next, newItem.text);
        return next;
      });
    }

    resolveParkedByKey(p.key, "returned");
    showToast(exists ? "既にToDoにあるので、保留だけ解消した" : "このStageに復帰させた");
  };

    const STRUCTURED_GRAMMAR_HINT = `
【出力フォーマット（構造文法・厳守）】
- Markdownで出す
- 出すのは次の2セクションだけ：
  【3. 完了条件（目指すゴール）】…チェック式 "- [ ]" で3〜5個
  【4. 分解（L1→L2→L3）】…L1はカテゴリ / L3は具体アクション
- 【重要：カテゴリ設計（最初の方針を復活）】
  - L1 は「カテゴリ（作業の入れ物）」として4〜6個作る
  - そのうち最低でも次の4つは入れる：目的 / 予算感 / 準備 / 段取り
    （明らかに関係ないときだけ省略してOK）
  - 各カテゴリ（L1）の下に、L2 を1〜3行、各L2の下に L3 を1〜3行は必ず出す
  - L3 は必ず行頭に "L3:" を付ける（抽出しやすくするため）
- 【日本語のルール】
  - 「する」を機械的に付けない（例：決める/用意する/確認する/買う/書く/まとめる など自然に）
  - 「決めるする」みたいな変な語尾は禁止
  - 質問形は禁止（？を出さない）
- 余計なメタ情報（長い前置き/注意書き/自分語り）は出さない（いきなり本文）
`.trim();

const runAnalysis = async () => {
    setError("");
    setBusy(true);
    try {
      const mainPrompt = draft.trim() || (list?.title ?? "");

      const res = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: mainPrompt.slice(0, 4000),
          context: STRUCTURED_GRAMMAR_HINT,
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }

      const ct = res.headers.get("content-type") || "";
      let text = "";
      if (ct.includes("application/json")) {
        const data: any = await res.json();
        text = String(data?.text ?? data?.result ?? data?.message ?? "");
      } else {
        text = await res.text();
      }
      if (!text.trim()) throw new Error("AIの返答が空だった…");

      const wasEmpty = checklist.length === 0;

      snapshotStage();

      const cleaned = sanitizeAnalysis(text);
      setAiResult(cleaned);

      const newGoals = extractGoalsFromCompletion(cleaned);
      setGoals(newGoals);

      const initial5 = pickInitial5FromAnalysis(cleaned);

      if (wasEmpty) {
        // 初回は「作戦の初期化」扱い（進捗や保留をクリア）
        setArchivedCreated(0);
        setArchivedDone(0);
        setParked([]);

        setChecklist(initial5);
        setStage(1);
        setUsedActionKeys(initial5.map((x) => x.text));

        showToast("分析→ゴール→最初のToDo5つを作った");
      } else {
        // 既存のToDo（手入力含む）は残す。AIから拾えた分だけ追加する。
        const existing = new Set(checklist.map((x) => x.text.trim()).filter(Boolean));
        const toAdd = initial5.filter((x) => {
          const t = x.text.trim();
          if (!t) return false;
          if (existing.has(t)) return false;
          existing.add(t);
          return true;
        });

        if (toAdd.length > 0) {
          setChecklist((prev) => {
            const prevSet = new Set(prev.map((x) => x.text.trim()).filter(Boolean));
            const add2 = initial5.filter((x) => {
              const t = x.text.trim();
              if (!t) return false;
              if (prevSet.has(t)) return false;
              prevSet.add(t);
              return true;
            });
            return add2.length ? [...prev, ...add2] : prev;
          });
        }

        setUsedActionKeys((prev) => {
          const s = new Set(prev);
          for (const x of initial5) {
            const t = x.text.trim();
            if (t) s.add(t);
          }
          return Array.from(s);
        });

        setStage((v) => v || 1);

        showToast(toAdd.length > 0 ? `分析を更新＋ToDoを${toAdd.length}件追加した` : "分析を更新（ToDoはそのまま）");
      }
    } catch (e: any) {
      setError(`分析でエラー：${String(e?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
  };

  const decomposeTodo = async (itemId: string) => {
    setError("");
    const target = checklist.find((x) => x.id === itemId);
    if (!target) return;
    if ((target.type ?? "task") === "group") return;

    setBusyItemId(itemId);
    try {
      const SUBTASK_HINT = `
次のToDoを、実行できるサブToDoに3〜7個へ分解して。
- 出力はMarkdownの箇条書きだけ（見出し・説明は禁止）
- 1行1タスクで、各行は「〜する」で終える
`.trim();

      const res = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          todo: target.text,
          context: `${SUBTASK_HINT}\n\n---\n参考ゴール:\n${goals.join("\n")}\n\n参考メモ:\n${draft}`,
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }

      const ct = res.headers.get("content-type") || "";
      let text = "";
      if (ct.includes("application/json")) {
        const data: any = await res.json();
        text = String(data?.text ?? data?.result ?? data?.message ?? "");
      } else {
        text = await res.text();
      }
      if (!text.trim()) throw new Error("分解結果が空だった…");

      const subs = extractSubTasks(text);
      if (subs.length === 0) throw new Error("サブToDoを抽出できなかった（出力形式が崩れてる）");

      snapshotStage();

      setChecklist((prev) => {
        const idx = prev.findIndex((x) => x.id === itemId);
        if (idx < 0) return prev;

        const parent = prev[idx];
        const parentDepth = parent.depth ?? 0;

        const groupParent: ChecklistItem = {
          ...parent,
          type: "group",
          done: true,
          status: "normal",
        };

        const childDepth = parentDepth + 1;
        const childCategory = `分解：${parent.category || "未分類"}`;

        const children: ChecklistItem[] = subs.map((t) => ({
          id: uid(),
          text: normalizeTodoText(t),
          done: false,
          category: childCategory,
          createdAt: new Date().toISOString(),
          type: "task",
          depth: childDepth,
          status: "normal",
        }));

        const next = [...prev];
        next[idx] = groupParent;
        next.splice(idx + 1, 0, ...children);
        return next;
      });

      setUsedActionKeys((prev) => {
        const next = [...prev];
        for (const t of subs) uniquePush(next, t);
        return next;
      });

      showToast(`分解して追加した（+${subs.length}）`);
    } catch (e: any) {
      setError(`分解でエラー：${String(e?.message ?? e)}`);
    } finally {
      setBusyItemId(null);
    }
  };

  // ✅ 次ステージ生成：候補がないなら「ない」と通知して何もしない
  const generateNextStage = () => {
    if (!canGenerateNextStage) {
      showToast("先に3つチェック or 未完了2つ以下になったら作れる");
      return;
    }
    if (!aiResult.trim()) {
      showToast("先に分析（AI）してね");
      return;
    }

    const cleaned = sanitizeAnalysis(aiResult);
    const cands = extractActionCandidates(cleaned);
    const used = new Set(usedActionKeys.map((x) => x.toLowerCase()));

    // 未使用候補をユニーク化
    const available: { category: string; action: string }[] = [];
    const seen = new Set<string>();
    for (const c of cands) {
      const k = c.action.toLowerCase();
      if (used.has(k)) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      available.push(c);
    }

    // ✅ 次が無い
    if (available.length === 0) {
      showToast("次のToDoがもうない。下書きを足して分析し直すか、「さらに分解」で増やしてね");
      return;
    }

    snapshotStage();

    // 未完了タスクは保留へ（あとまわし）
    const carry = taskItems.filter((t) => !t.done);
    if (carry.length > 0) {
      setParked((prev) => {
        const now = new Date().toISOString();
        const next = [...prev];
        for (const t of carry) {
          const key = itemKey(t.text, t.category);
          const idx = next.findIndex((p) => p.key === key);
          if (idx < 0) {
            const created: ParkedItem = {
              key,
              text: t.text,
              category: t.category || "未分類",
              status: "later",
              stage: stage || 0,
              createdAt: now,
              updatedAt: now,
            };
            next.unshift(created);
          } else {
            const cur = next[idx];
            const keepStatus: ParkedItem["status"] = cur.status === "unknown" && !cur.resolvedAt ? "unknown" : "later";
            next[idx] = {
              ...cur,
              text: t.text,
              category: t.category || "未分類",
              status: keepStatus,
              stage: cur.stage || stage || 0,
              updatedAt: now,
              resolvedAt: undefined,
              resolution: undefined,
            };
          }
        }
        return next;
      });
    }

    // 総進捗ロールアップ
    setArchivedCreated((v) => v + totalTasks);
    setArchivedDone((v) => v + doneTasks);

    // 次ステージの最大5つを、未使用候補からカテゴリ分散で拾う
    const picked: { category: string; action: string }[] = [];
    const usedCat = new Set<string>();

    for (const c of available) {
      if (picked.length >= 5) break;
      const catKey = (c.category || "未分類").toLowerCase();
      if (usedCat.has(catKey)) continue;
      picked.push(c);
      usedCat.add(catKey);
    }

    for (const c of available) {
      if (picked.length >= 5) break;
      const key = c.action.toLowerCase();
      if (picked.some((p) => p.action.toLowerCase() === key)) continue;
      picked.push(c);
    }

    // ✅ 残りが少ないときは少ないまま作る（フォールバックで水増ししない）
    const nextPack = picked.slice(0, 5);

    const nextTodos: ChecklistItem[] = nextPack.map((p) => ({
      id: uid(),
      text: normalizeTodoText(p.action),
      done: false,
      category: p.category || "未分類",
      createdAt: new Date().toISOString(),
      type: "task",
      depth: 0,
      status: "normal",
    }));

    setChecklist(nextTodos);
    setStage((s) => (s >= 1 ? s + 1 : 2));

    setUsedActionKeys((prev) => {
      const next = [...prev];
      for (const it of nextTodos) uniquePush(next, it.text);
      return next;
    });

    // ✅ 残り数の通知
    const remainingAfter = Math.max(available.length - nextTodos.length, 0);
    if (remainingAfter === 0) {
      showToast(`次のToDoを${nextTodos.length}個作った（これで最後）`);
    } else {
      showToast(`次のToDoを${nextTodos.length}個作った（残り候補 ${remainingAfter}）`);
    }
  };

  const generateIssuedPrompt = () => {
    const p = buildBatonPassPrompt({
      draft,
      aiResult,
      goals,
      checklist,
      stage,
      includeDraft: includeDraftInPrompt,
      includeAnalysis: includeAnalysisInPrompt,
    });
    setIssuedPrompt(p);
    showToast("プロンプト発行した");
    window.setTimeout(() => {
      issuedPromptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      issuedPromptRef.current?.focus();
    }, 0);
  };

  const copyPromptOnly = () => {
    if (!issuedPrompt.trim()) {
      showToast("先にプロンプト発行してね");
      return;
    }
    copyText(issuedPrompt, "プロンプトをコピーした");
  };

  const copyAll = () => {
    const p = issuedPrompt.trim()
      ? issuedPrompt.trim()
      : buildBatonPassPrompt({
          draft,
          aiResult,
          goals,
          checklist,
          stage,
          includeDraft: includeDraftInPrompt,
          includeAnalysis: includeAnalysisInPrompt,
        });

    const combined = [
      p.trim(),
      "",
      "---",
      "",
      "## ゴール",
      goalsToMarkdown(goals),
      "",
      "## ToDo",
      checklistToMarkdown(checklist),
    ].join("\n");
    copyText(combined, "ゴール＋ToDo＋プロンプトをコピーした");
  };

  if (!listId) {
    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <p className={styles.errorBox}>IDが取れなかった。いったん Lists に戻って開き直してね。</p>
          <Link className={styles.linkBtn} href="/lists">
            ← Listsへ
          </Link>
        </div>
      </main>
    );
  }

  const nextBtnLabel = !aiResult.trim()
    ? "次のToDo5つを作る"
    : hasNextCandidates
      ? `次のToDoを作る（候補残り ${nextCandidateRemaining}）`
      : "次のToDoはもうない";

  const nextBtnClass =
    !hasNextCandidates && aiResult.trim()
      ? styles.btnWarn
      : canGenerateNextStage
        ? styles.btnPrimary
        : styles.btnDisabled;

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
        <p className={styles.subtitle}>下書き → 分析（構造文法）→ ゴール → ToDo（分解/わからない/あとまわし）＋総進捗</p>
      </header>

      <div className={styles.container}>
        {/* 1) 下書き */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>1) 下書き（雑に放り込んでOK）</h2>
            <span className={styles.mini}>ここだけで分析できる</span>
          </div>

          <textarea
            className={styles.textarea}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="例）通帳だけ／家賃入金／控除／支出…など雑に"
          />

          <div className={styles.row}>
            <button className={styles.btnPrimary} onClick={runAnalysis} disabled={busy} type="button">
              {busy ? "分析中…" : "AIで分析する（ゴール→最初のToDo5つ）"}
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

        {/* 2) 分析 */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>2) 分析（構造文法）</h2>
            <span className={styles.mini}>AIの生テキスト（メタは削って表示）</span>
          </div>

          {aiResult.trim() ? <pre className={styles.pre}>{aiResult}</pre> : <p className={styles.pMuted}>（まだ分析してないよ）</p>}

          {aiResult.trim() && (
            <div className={styles.row}>
              <button className={styles.btnGhost} onClick={() => copyText(aiResult, "分析をコピーした")} type="button">
                分析をコピー
              </button>
            </div>
          )}
        </section>

        {/* 3) ゴール */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>3) 目指すゴール（完了条件）</h2>
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
            <p className={styles.pMuted}>（まだゴールがないよ。AIで分析すると自動で入る）</p>
          )}

          <div className={styles.row}>
            <button className={styles.btnGhost} onClick={() => copyText(goalsToMarkdown(goals), "ゴールをコピーした")} type="button">
              ゴールをコピー（Markdown）
            </button>
          </div>
        </section>

        {/* 4) ToDo */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>4) ToDo（分解で増える）</h2>
            <span className={styles.mini}>Stage {stage || 0}</span>
          </div>

          {/* 総進捗 */}
          <div className={styles.overallRow}>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>見込みTodo数</div>
              <div className={styles.kpiValue}>{expectedTotal}</div>
              <div className={styles.kpiHint}>（分析候補={l3Count} / 生成済み={issuedTotal}）</div>
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

          {/* 現ステージ進捗 */}
          <div className={styles.kpiRow}>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>このStage 合計</div>
              <div className={styles.kpiValue}>{totalTasks}</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>このStage 完了</div>
              <div className={styles.kpiValue}>{doneTasks}</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>このStage 残り</div>
              <div className={styles.kpiValue}>{remainingTasks}</div>
            </div>
            <div className={styles.kpiWide}>
              <div className={styles.kpiLabel}>このStage 進捗</div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
              </div>
              <div className={styles.kpiHint}>{progressPct}%</div>
            </div>
          </div>

          {/* 保留ボード */}
          <div className={styles.parkingBox}>
            <div className={styles.parkingHead}>
              <div className={styles.parkingTitle}>
                保留ボード（わからない / あとまわし）
                <span className={styles.parkingMeta}>
                  未解決 {parkedUnresolved.length} / 解消 {parkedResolved.length}
                </span>
              </div>
              <button className={styles.btnMiniGhost} onClick={() => setParkingOpen((v) => !v)} type="button">
                {parkingOpen ? "たたむ" : "ひらく"}
              </button>
            </div>

            {parkingOpen && (
              <div className={styles.parkingBody}>
                {parked.length === 0 ? (
                  <p className={styles.pMuted}>（まだ保留はないよ）</p>
                ) : (
                  <>
                    <div className={styles.parkingSection}>
                      <div className={styles.parkingSectionTitle}>未解決</div>
                      {parkedUnresolved.length === 0 ? (
                        <p className={styles.pMuted}>（未解決なし）</p>
                      ) : (
                        <div className={styles.parkingList}>
                          {parkedUnresolved.map((p) => (
                            <div key={p.key} className={styles.parkingItem}>
                              <span className={`${styles.statusPill} ${p.status === "unknown" ? styles.statusUnknown : styles.statusLater}`}>
                                {p.status === "unknown" ? "わからない" : "あとまわし"}
                              </span>
                              <span className={styles.tag}>{p.category}</span>
                              <span className={styles.parkingText}>{p.text}</span>
                              <span className={styles.parkingRight}>Stage {p.stage}</span>

                              <button className={styles.btnMiniRevive} onClick={() => reviveParkedToStage(p)} type="button">
                                このStageに復帰
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className={styles.parkingSection}>
                      <div className={styles.parkingSectionTitle}>解消済み</div>
                      {parkedResolved.length === 0 ? (
                        <p className={styles.pMuted}>（解消済みなし）</p>
                      ) : (
                        <div className={styles.parkingList}>
                          {parkedResolved.slice(0, 30).map((p) => (
                            <div key={p.key} className={`${styles.parkingItem} ${styles.parkingResolved}`}>
                              <span className={`${styles.statusPill} ${p.status === "unknown" ? styles.statusUnknown : styles.statusLater}`}>
                                {p.status === "unknown" ? "わからない" : "あとまわし"}
                              </span>
                              <span className={styles.tag}>{p.category}</span>
                              <span className={styles.parkingText}>{p.text}</span>
                              <span className={styles.parkingRight}>
                                {p.resolution === "returned"
                                  ? "復帰"
                                  : p.resolution === "done"
                                    ? "完了"
                                    : p.resolution === "deleted"
                                      ? "削除"
                                      : "解除"}
                              </span>
                            </div>
                          ))}
                          {parkedResolved.length > 30 && <p className={styles.pMuted}>（解消済みは最新30件だけ表示）</p>}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <p className={styles.p}>
            ルール：<b>3つチェック</b> または <b>未完了が2つ以下</b> で「次のToDo」を作れる。未完了は自動で保留に送る。
          </p>

          {aiResult.trim() && !hasNextCandidates && (
            <p className={styles.infoNote}>次のToDo候補はもうないよ。下書きを増やして分析し直すか、「さらに分解」で増やしてね。</p>
          )}

          {/* 手入力でToDoを追加（AI分析しても消えない） */}
          <div className={styles.manualAdd}>
            <div className={styles.row}>
              <input
                className={styles.textInput}
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addManualTodo();
                  }
                }}
                placeholder="ToDoを手入力（例：領収書をまとめる）"
              />
              <input
                className={styles.textInput}
                value={newTodoCategory}
                onChange={(e) => setNewTodoCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addManualTodo();
                  }
                }}
                placeholder="カテゴリ（任意）"
              />
              <button className={styles.btnPrimary} onClick={addManualTodo} disabled={!newTodoText.trim()} type="button">
                追加
              </button>
            </div>
            <p className={styles.pMuted} style={{ marginTop: 6 }}>
              ※ここで追加したToDoは、あとでAI分析しても消えない
            </p>
          </div>

          {checklist.length === 0 ? (
            <p className={styles.pMuted} style={{ marginTop: 10 }}>
              （AIで分析すると、最初の5つが自動で入る）
            </p>
          ) : (
            <div className={styles.listBox}>
              {checklist.map((it) => {
                const isGroup = (it.type ?? "task") === "group";
                const indent = (it.depth ?? 0) * 14;
                const status = it.status ?? "normal";

                return (
                  <div
                    key={it.id}
                    className={`${styles.itemRow} ${isGroup ? styles.groupRow : ""} ${
                      status === "unknown" ? styles.statusRowUnknown : status === "later" ? styles.statusRowLater : ""
                    }`}
                    style={{ marginLeft: indent }}
                  >
                    <label className={styles.itemLabel}>
                      <input
                        type="checkbox"
                        checked={isGroup ? true : it.done}
                        disabled={isGroup}
                        onChange={() => toggleItem(it.id)}
                      />
                      <span className={styles.tag}>{it.category || "未分類"}</span>

                      {status !== "normal" && (
                        <span className={`${styles.statusPill} ${status === "unknown" ? styles.statusUnknown : styles.statusLater}`}>
                          {status === "unknown" ? "わからない" : "あとまわし"}
                        </span>
                      )}

                      <span className={isGroup ? styles.groupTitle : it.done ? styles.itemDone : ""}>{it.text}</span>
                    </label>

                    <div className={styles.itemActions}>
                      {!isGroup && (
                        <>
                          <button
                            className={styles.btnMiniPrimary}
                            onClick={() => decomposeTodo(it.id)}
                            type="button"
                            disabled={busyItemId === it.id}
                            title="このToDoをさらに分解してサブToDoを追加"
                          >
                            {busyItemId === it.id ? "分解中…" : "さらに分解"}
                          </button>

                          <button className={styles.btnMiniGhost} onClick={() => setUnknown(it.id)} type="button">
                            わからない
                          </button>

                          <button className={styles.btnMiniLater} onClick={() => setLater(it.id)} type="button">
                            あとまわし
                          </button>
                        </>
                      )}

                      <button className={styles.btnDanger} onClick={() => deleteItem(it.id)} type="button">
                        削除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles.row} style={{ marginTop: 12 }}>
            <button className={styles.btnGhost} onClick={() => copyText(checklistToMarkdown(checklist), "ToDoをコピーした")} type="button">
              ToDoをコピー（Markdown）
            </button>

            <button
              className={nextBtnClass}
              onClick={generateNextStage}
              type="button"
              disabled={!canGenerateNextStage}
              title={
                !canGenerateNextStage
                  ? "3つチェック or 未完了2つ以下で解放"
                  : !hasNextCandidates && aiResult.trim()
                    ? "候補がもうない（分析し直す or 分解で増やす）"
                    : ""
              }
            >
              {nextBtnLabel}
            </button>

            <button
              className={styles.btnGhost}
              onClick={() => {
                const ok = window.confirm("ToDoを全部クリアする？（戻すボタンで復旧できる）");
                if (!ok) return;
                snapshotStage();
                setChecklist([]);
                setStage(0);
                setUsedActionKeys([]);
                showToast("ToDoをクリアした");
              }}
              type="button"
            >
              全クリア
            </button>
          </div>
        </section>

        {/* 5) プロンプト発行 */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>5) プロンプト発行（他AIへバトンパス）</h2>
            <span className={styles.mini}>デフォはゴール＋ToDoだけ</span>
          </div>

          <div className={styles.toggleRow}>
            <label className={styles.toggle}>
              <input type="checkbox" checked={includeDraftInPrompt} onChange={(e) => setIncludeDraftInPrompt(e.target.checked)} />
              <span>下書きを含める</span>
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" checked={includeAnalysisInPrompt} onChange={(e) => setIncludeAnalysisInPrompt(e.target.checked)} />
              <span>分析を含める</span>
            </label>
          </div>

          <div className={styles.row}>
            <button className={styles.btnPrimary} onClick={generateIssuedPrompt} type="button">
              プロンプト発行
            </button>
            <button className={styles.btnGhost} onClick={copyPromptOnly} type="button">
              プロンプトをコピー
            </button>
            <button className={styles.btnGhost} onClick={copyAll} type="button">
              ゴール＋ToDo＋プロンプトをコピー
            </button>
          </div>

          <textarea
            ref={issuedPromptRef}
            className={styles.textarea}
            value={issuedPrompt}
            onChange={(e) => setIssuedPrompt(e.target.value)}
            placeholder="（ここに発行されたMarkdownが入る）"
            style={{ marginTop: 10 }}
          />
        </section>

        {toast && <div className={styles.toast}>{toast}</div>}
      </div>
    </main>
  );
}
