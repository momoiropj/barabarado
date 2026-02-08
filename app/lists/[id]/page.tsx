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

  type?: "task" | "group"; // task=カウント対象 / group=見出し（カウント対象外）
  depth?: number; // インデント
  status?: ItemStatus; // 追加：わからない/あとまわし
};

type StageSnapshot = {
  stage: number;
  createdAt: string;
  items: ChecklistItem[];
  goals: string[];
  aiResult: string;
  draft: string;
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

function toSuruForm(input: string): string {
  let s = normalizeLine(input);
  s = s.replace(/[。．]$/, "").trim();

  if (s.endsWith("します")) return s.replace(/します$/, "する");
  if (s.endsWith("する")) return s;

  const repl: Array<[RegExp, string]> = [
    [/書き出す$/, "列挙する"],
    [/書く$/, "記載する"],
    [/作る$/, "作成する"],
    [/決める$/, "決定する"],
    [/入れる$/, "入力する"],
    [/まとめる$/, "整理する"],
    [/集める$/, "収集する"],
    [/選ぶ$/, "選定する"],
    [/直す$/, "修正する"],
    [/見る$/, "確認する"],
  ];
  for (const [re, rep] of repl) {
    if (re.test(s)) return s.replace(re, rep);
  }

  if (/(メモ|整理|作成|設定|確認|調整|検討|共有|記録)$/.test(s)) return s + "する";
  return s + "する";
}

function loadDetail(listId: string): SavedDetail {
  const key = `${DETAIL_KEY_PREFIX}${listId}`;
  const parsed = safeParseJSON<Partial<SavedDetail>>(localStorage.getItem(key));
  const now = new Date().toISOString();

  const normalizeChecklist = (arr: any[] | undefined): ChecklistItem[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x: any) => ({
        id: String(x?.id ?? uid()),
        text: String(x?.text ?? ""),
        done: Boolean(x?.done ?? false),
        category: String(x?.category ?? "未分類"),
        createdAt: x?.createdAt ? String(x.createdAt) : undefined,
        type: x?.type === "group" ? "group" : "task",
        depth: Number.isFinite(x?.depth) ? Number(x.depth) : 0,
        status: x?.status === "unknown" ? "unknown" : x?.status === "later" ? "later" : "normal",
      }))
      .filter((x) => x.text);
  };

  const stageHistory = Array.isArray((parsed as any)?.stageHistory)
    ? ((parsed as any).stageHistory as any[])
        .map((h) => ({
          stage: Number(h?.stage ?? 0),
          createdAt: String(h?.createdAt ?? ""),
          items: normalizeChecklist(h?.items),
          goals: Array.isArray(h?.goals) ? h.goals.map((g: any) => String(g)) : [],
          aiResult: String(h?.aiResult ?? ""),
          draft: String(h?.draft ?? ""),
        }))
        .filter((h) => h.stage && h.createdAt)
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
    updatedAt: String((parsed as any)?.updatedAt ?? now),
  };
}

function saveDetail(listId: string, detail: SavedDetail) {
  const key = `${DETAIL_KEY_PREFIX}${listId}`;
  localStorage.setItem(key, JSON.stringify(detail));
}

/** AIのL1/L3構造をざっくりパース */
function parseL1L3(text: string): { l1Order: string[]; l3ByL1: Record<string, string[]>; allL3: string[] } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const l1Order: string[] = [];
  const l3ByL1: Record<string, string[]> = {};
  const allL3: string[] = [];

  let currentL1 = "未分類";

  for (const raw of lines) {
    const line = raw.replace(/^[-*•]\s*/, "").trim();

    const m1 = line.match(/^L1[:：]\s*(.+)$/);
    if (m1) {
      currentL1 = normalizeLine(m1[1] ?? "") || "未分類";
      if (!l1Order.some((x) => x.toLowerCase() === currentL1.toLowerCase())) l1Order.push(currentL1);
      if (!l3ByL1[currentL1]) l3ByL1[currentL1] = [];
      continue;
    }

    const m3 = line.match(/^L3[:：]\s*(.+)$/);
    if (m3) {
      const t = normalizeLine(m3[1] ?? "");
      if (!t) continue;
      if (t.includes("？") || t.includes("?")) continue;
      const act = toSuruForm(t);
      if (!l3ByL1[currentL1]) l3ByL1[currentL1] = [];
      uniquePush(l3ByL1[currentL1], act);
      uniquePush(allL3, act);
      continue;
    }
  }

  return { l1Order, l3ByL1, allL3 };
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

/** 最初のToDo5つを作る：L3をカテゴリ分散で拾う */
function buildInitial5Todos(aiResult: string): ChecklistItem[] {
  const { l1Order, l3ByL1, allL3 } = parseL1L3(aiResult);

  const picked: Array<{ category: string; text: string }> = [];

  for (const l1 of l1Order) {
    const arr = l3ByL1[l1] ?? [];
    const cand = arr[0];
    if (!cand) continue;
    if (picked.some((p) => p.text.toLowerCase() === cand.toLowerCase())) continue;
    picked.push({ category: l1, text: cand });
    if (picked.length >= 5) break;
  }

  if (picked.length < 5) {
    for (const a of allL3) {
      if (picked.length >= 5) break;
      if (picked.some((p) => p.text.toLowerCase() === a.toLowerCase())) continue;
      picked.push({ category: "未分類", text: a });
    }
  }

  const fallback: Array<{ category: string; text: string }> = [
    { category: "設計", text: "対象範囲（入れる/入れない）を決定する" },
    { category: "テスト", text: "主要フローのテスト観点表を作成する" },
    { category: "修正", text: "致命バグの定義を決定する" },
    { category: "回収", text: "フィードバックアンケートフォームを作成する" },
    { category: "募集", text: "テストユーザー募集ページを作成する" },
  ].map((x) => ({ ...x, text: toSuruForm(x.text) }));

  while (picked.length < 5) picked.push(fallback[picked.length]);

  return picked.slice(0, 5).map((p) => ({
    id: uid(),
    text: toSuruForm(p.text),
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
  return tasks.map((it) => `- [${it.done ? "x" : " "}] [${it.category || "未分類"}] ${it.text}`).join("\n");
}

/** バトンパス用プロンプト：デフォで「ゴール＋ToDo」だけ（下書き/分析は任意） */
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
function removeWithDescendants(items: ChecklistItem[], index: number): ChecklistItem[] {
  const parentDepth = items[index]?.depth ?? 0;
  let end = index + 1;
  while (end < items.length) {
    const d = items[end]?.depth ?? 0;
    if (d <= parentDepth) break;
    end++;
  }
  return items.slice(0, index).concat(items.slice(end));
}

/** indexのアイテム + 子孫を、同じ親スコープの末尾へ移動（あとまわし用） */
function moveBlockToParentEnd(items: ChecklistItem[], index: number): ChecklistItem[] {
  const depth = items[index]?.depth ?? 0;

  // ブロック範囲
  let blockEnd = index + 1;
  while (blockEnd < items.length) {
    const d = items[blockEnd]?.depth ?? 0;
    if (d <= depth) break;
    blockEnd++;
  }

  // 親スコープ末尾（depth未満に戻る手前まで）
  let scopeEnd = blockEnd;
  while (scopeEnd < items.length) {
    const d = items[scopeEnd]?.depth ?? 0;
    if (d < depth) break;
    scopeEnd++;
  }

  if (scopeEnd === blockEnd) return items; // 既に末尾

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
      uniquePush(out, toSuruForm(t));
      continue;
    }

    const m3 = ln.match(/^L3[:：]\s*(.+)$/);
    if (m3?.[1]) {
      const t = normalizeLine(m3[1]);
      if (!t) continue;
      if (t.includes("？") || t.includes("?")) continue;
      uniquePush(out, toSuruForm(t));
      continue;
    }
  }

  if (out.length === 0) {
    for (const ln of lines) {
      const t = normalizeLine(ln.replace(/^[-*•]/, ""));
      if (!t) continue;
      if (t.length < 3) continue;
      if (t.includes("？") || t.includes("?")) continue;
      uniquePush(out, toSuruForm(t));
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
    toastTimer.current = window.setTimeout(() => setToast(null), 1400);
  };

  const [list, setList] = useState<ListRow | null>(null);

  const [draft, setDraft] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [goals, setGoals] = useState<string[]>([]);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [stage, setStage] = useState<number>(0);
  const [usedActionKeys, setUsedActionKeys] = useState<string[]>([]);
  const [stageHistory, setStageHistory] = useState<StageSnapshot[]>([]);

  const [issuedPrompt, setIssuedPrompt] = useState("");
  const issuedPromptRef = useRef<HTMLTextAreaElement | null>(null);

  const [includeDraftInPrompt, setIncludeDraftInPrompt] = useState(false);
  const [includeAnalysisInPrompt, setIncludeAnalysisInPrompt] = useState(false);

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
  }, [listId, draft, aiResult, goals, checklist, stage, usedActionKeys, stageHistory, issuedPrompt]);

  const goBack = () => router.push("/lists");

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
    };
    setStageHistory([snap, ...stageHistory].slice(0, 20));
  };

  const restoreLatestSnapshot = () => {
    const latest = stageHistory[0];
    if (!latest) return;
    setAiResult(latest.aiResult);
    setGoals(latest.goals);
    setChecklist(latest.items);
    setStage(latest.stage);
    setDraft(latest.draft);
    setStageHistory(stageHistory.slice(1));
    showToast("ひとつ前の状態に戻した");
  };

  const toggleItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        if ((x.type ?? "task") === "group") return x;
        return { ...x, done: !x.done };
      })
    );
  };

  const deleteItem = (id: string) => {
    setChecklist((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx < 0) return prev;
      return removeWithDescendants(prev, idx);
    });
    showToast("削除した");
  };

  const setUnknown = (id: string) => {
    setChecklist((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        if ((x.type ?? "task") === "group") return x;
        const nextStatus: ItemStatus = x.status === "unknown" ? "normal" : "unknown";
        return { ...x, status: nextStatus, done: nextStatus === "unknown" ? false : x.done };
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

      // toggling: normal/unknown -> later (move), later -> normal (no move)
      const toLater = it.status !== "later";
      const updated = [...prev];
      updated[idx] = { ...it, status: toLater ? "later" : "normal", done: false };

      return toLater ? moveBlockToParentEnd(updated, idx) : updated;
    });
    showToast("「あとまわし」を切り替えた");
  };

  // KPI：taskだけカウント
  const taskItems = checklist.filter((x) => (x.type ?? "task") === "task");
  const totalTasks = taskItems.length;
  const doneTasks = taskItems.filter((x) => x.done).length;
  const remainingTasks = totalTasks - doneTasks;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const canGenerateNextStage = doneTasks >= 3 || remainingTasks <= 2;

  const STRUCTURED_GRAMMAR_HINT = `
【出力フォーマット（構造文法・厳守）】
- Markdownで出す
- セクション順は必ずこの順番：
  1) 【完了条件（目指すゴール）】…チェック式 "- [ ]" で3〜5個
  2) 【分解（L1→L2→L3）】…L3は必ず「〜する」で終える
- 「気持ち/現状/なぜ/段取り/予算/準備物」などのメタ情報セクションは出さない
`.trim();

  const runAnalysis = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          todo: list?.title ?? "",
          context: `${draft}\n\n---\n${STRUCTURED_GRAMMAR_HINT}`,
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

      snapshotStage();
      setAiResult(text);

      const newGoals = extractGoalsFromCompletion(text);
      setGoals(newGoals);

      const initial5 = buildInitial5Todos(text);
      setChecklist(initial5);
      setStage(1);

      setUsedActionKeys(initial5.map((x) => x.text));
      showToast("分析→ゴール→最初のToDo5つを作った");
    } catch (e: any) {
      setError(`分析でエラー：${String(e?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
  };

  // ✅ 各ToDoをさらに分解
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
          text: toSuruForm(t),
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

  const generateNextStage = () => {
    if (!canGenerateNextStage) {
      showToast("先に3つチェック or 未完了2つ以下になったら作れる");
      return;
    }
    if (!aiResult.trim()) {
      showToast("先に分析（AI）してね");
      return;
    }

    snapshotStage();

    const used = new Set(usedActionKeys.map((x) => x.toLowerCase()));
    const { l1Order, l3ByL1, allL3 } = parseL1L3(aiResult);

    const picked: Array<{ category: string; text: string }> = [];

    for (const l1 of l1Order) {
      if (picked.length >= 5) break;
      const arr = l3ByL1[l1] ?? [];
      const cand = arr.find((x) => !used.has(x.toLowerCase()));
      if (!cand) continue;
      picked.push({ category: l1, text: cand });
    }
    if (picked.length < 5) {
      for (const a of allL3) {
        if (picked.length >= 5) break;
        if (used.has(a.toLowerCase())) continue;
        picked.push({ category: "未分類", text: a });
      }
    }

    const fallback: Array<{ category: string; text: string }> = [
      { category: "設計", text: "対象範囲を決定する" },
      { category: "テスト", text: "テスト観点表を作成する" },
      { category: "修正", text: "致命バグを修正する" },
      { category: "回収", text: "アンケート導線を設置する" },
      { category: "募集", text: "募集ページを公開する" },
    ].map((x) => ({ ...x, text: toSuruForm(x.text) }));

    while (picked.length < 5) picked.push(fallback[picked.length]);

    const next5: ChecklistItem[] = picked.slice(0, 5).map((p) => ({
      id: uid(),
      text: toSuruForm(p.text),
      done: false,
      category: p.category || "未分類",
      createdAt: new Date().toISOString(),
      type: "task",
      depth: 0,
      status: "normal",
    }));

    setChecklist(next5);
    setStage((s) => (s >= 1 ? s + 1 : 2));

    setUsedActionKeys((prev) => {
      const next = [...prev];
      for (const it of next5) uniquePush(next, it.text);
      return next;
    });

    showToast("次のToDo5つを作った");
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

    const combined = [p.trim(), "", "---", "", "## ゴール", goalsToMarkdown(goals), "", "## ToDo", checklistToMarkdown(checklist)].join(
      "\n"
    );
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

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <button className={styles.backBtn} onClick={goBack} type="button">
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
        <p className={styles.subtitle}>下書き → 分析（構造文法）→ ゴール明記 → ToDo（各ToDoをさらに分解/わからない/あとまわし）</p>
      </header>

      <div className={styles.container}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>1) 下書き（雑に放り込んでOK）</h2>
            <span className={styles.mini}>ここだけで分析できる</span>
          </div>

          <textarea
            className={styles.textarea}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="例）動作確認、バグつぶし、アンケート、募集ページ…など雑に"
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

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>2) 分析（構造文法）</h2>
            <span className={styles.mini}>AIの生テキスト</span>
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

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>4) ToDo（分解で増える）</h2>
            <span className={styles.mini}>Stage {stage || 0}</span>
          </div>

          <div className={styles.kpiRow}>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>合計</div>
              <div className={styles.kpiValue}>{totalTasks}</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>完了</div>
              <div className={styles.kpiValue}>{doneTasks}</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>残り</div>
              <div className={styles.kpiValue}>{remainingTasks}</div>
            </div>
            <div className={styles.kpiWide}>
              <div className={styles.kpiLabel}>進捗</div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
              </div>
              <div className={styles.kpiHint}>{progressPct}%</div>
            </div>
          </div>

          <p className={styles.p}>
            ルール：<b>3つチェック</b> または <b>未完了が2つ以下</b> で「次のToDo5つ」を作れる。
          </p>

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
                        <span
                          className={`${styles.statusPill} ${
                            status === "unknown" ? styles.statusUnknown : styles.statusLater
                          }`}
                        >
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
              className={canGenerateNextStage ? styles.btnPrimary : styles.btnDisabled}
              onClick={generateNextStage}
              type="button"
              disabled={!canGenerateNextStage}
              title={canGenerateNextStage ? "" : "3つチェック or 未完了2つ以下で解放"}
            >
              次のToDo5つを作る
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
