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

  const lines = text.split("\n");
  const filtered = lines.filter((l) => !/^\s*【\s*[12]/.test(l));
  return filtered.join("\n").trim();
}

type ActionCandidate = { category: string; action: string };

function extractActionCandidates(markdown: string): ActionCandidate[] {
  const lines = markdown.split("\n").map((l) => l.trim()).filter(Boolean);

  let curCategory = "未分類";
  const out: ActionCandidate[] = [];

  for (const ln of lines) {
    const mCat = ln.match(/^\s*\[([^\]]+)\]\s*$/);
    if (mCat?.[1]) {
      curCategory = normalizeLine(mCat[1]) || "未分類";
      continue;
    }

    const mTask = ln.match(/^[-*•]\s+(.+)$/);
    if (mTask?.[1]) {
      const t = normalizeLine(mTask[1]);
      if (!t) continue;
      if (t.includes("？") || t.includes("?")) continue;
      out.push({ category: curCategory, action: toSuruForm(t) });
      continue;
    }

    const m3 = ln.match(/^L3[:：]\s*(.+)$/);
    if (m3?.[1]) {
      const t = normalizeLine(m3[1]);
      if (!t) continue;
      if (t.includes("？") || t.includes("?")) continue;
      out.push({ category: curCategory, action: toSuruForm(t) });
    }
  }

  return out;
}

function buildBatonPassPrompt(args: {
  draft: string;
  aiResult: string;
  goals: string[];
  checklist: ChecklistItem[];
  stage: number;
  includeDraft: boolean;
  includeAnalysis: boolean;
}) {
  const { draft, aiResult, goals, checklist, stage, includeDraft, includeAnalysis } = args;

  const goalBlock =
    goals.length > 0
      ? `## ゴール\n\n${goals.map((g) => `- ${normalizeLine(g)}`).join("\n")}`
      : `## ゴール\n\n（未設定）`;

  const todoBlock =
    checklist.length > 0
      ? `## 現在のToDo（Stage ${stage || 1}）\n\n${checklist
          .map((x) => {
            const d = x.depth ?? 0;
            const indent = "  ".repeat(Math.max(d, 0));
            const head = (x.type ?? "task") === "group" ? "◼︎" : "-";
            const status = x.status ? ` (${x.status})` : "";
            const done = x.done ? " ✅" : "";
            return `${indent}${head} ${normalizeLine(x.text)}${status}${done}`;
          })
          .join("\n")}`
      : `## 現在のToDo（Stage ${stage || 1}）\n\n（空）`;

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
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  };

  const [list, setList] = useState<ListRow | null>(null);

  const [draft, setDraft] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [goals, setGoals] = useState<string[]>([]);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [stage, setStage] = useState<number>(0);

  const [usedActionKeys, setUsedActionKeys] = useState<string[]>([]);
  const [stageHistory, setStageHistory] = useState<StageSnapshot[]>([]);
  const [issuedPrompt, setIssuedPrompt] = useState<string>("");

  const [archivedCreated, setArchivedCreated] = useState<number>(0);
  const [archivedDone, setArchivedDone] = useState<number>(0);

  const [parked, setParked] = useState<ParkedItem[]>([]);

  const [includeDraftInPrompt, setIncludeDraftInPrompt] = useState<boolean>(true);
  const [includeAnalysisInPrompt, setIncludeAnalysisInPrompt] = useState<boolean>(true);

  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!listId) return;

    const lists = loadGuestLists();
    const row = lists.find((x) => x.id === listId) ?? null;
    setList(row);

    const d = loadDetail(listId);
    setDraft(d.draft);
    setAiResult(d.aiResult);
    setGoals(d.goals);
    setChecklist(d.checklist);
    setStage(d.stage || 1);
    setUsedActionKeys(d.usedActionKeys);
    setStageHistory(d.stageHistory);
    setIssuedPrompt(d.issuedPrompt);
    setArchivedCreated(d.archivedCreated);
    setArchivedDone(d.archivedDone);
    setParked(d.parked);
  }, [listId]);

  useEffect(() => {
    if (!listId) return;
    const detail: SavedDetail = {
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
    saveDetail(listId, detail);
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

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const taskItems = useMemo(() => checklist.filter((x) => (x.type ?? "task") === "task"), [checklist]);
  const totalTasks = taskItems.length;
  const doneTasks = taskItems.filter((x) => x.done).length;
  const remainingTasks = totalTasks - doneTasks;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const canGenerateNextStage = doneTasks >= 3 || remainingTasks <= 2;

  const l3Count = useMemo(() => {
    if (!aiResult.trim()) return 0;
    const cleaned = sanitizeAnalysis(aiResult);
    return extractActionCandidates(cleaned).length;
  }, [aiResult]);

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

  const snapshotStage = () => {
    const snap: StageSnapshot = {
      stage: stage || 1,
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
    setStageHistory((prev) => [snap, ...prev].slice(0, 30));
  };

  const restoreSnapshot = (snap: StageSnapshot) => {
    setDraft(snap.draft);
    setAiResult(snap.aiResult);
    setGoals(snap.goals);
    setChecklist(snap.items);
    setStage(snap.stage);
    setArchivedCreated(snap.archivedCreated);
    setArchivedDone(snap.archivedDone);
    setParked(snap.parked);
    setUsedActionKeys(snap.usedActionKeys);
    setIssuedPrompt(snap.issuedPrompt);

    setStageHistory((prev) => prev.filter((x) => x.createdAt !== snap.createdAt));
    showToast("スナップショットから戻した");
  };

  const clearAll = () => {
    if (!listId) return;
    localStorage.removeItem(`${DETAIL_KEY_PREFIX}${listId}`);
    showToast("クリアした");
    router.push("/lists");
  };

  const addGoal = () => setGoals((prev) => [...prev, ""]);
  const updateGoal = (idx: number, v: string) =>
    setGoals((prev) => prev.map((g, i) => (i === idx ? v : g)));
  const removeGoal = (idx: number) => setGoals((prev) => prev.filter((_, i) => i !== idx));

  const addItem = () => {
    const it: ChecklistItem = {
      id: uid(),
      text: "",
      done: false,
      category: "未分類",
      createdAt: new Date().toISOString(),
      type: "task",
      depth: 0,
      status: "normal",
    };
    setChecklist((prev) => [it, ...prev]);
  };

  const updateItem = (id: string, patch: Partial<ChecklistItem>) => {
    setChecklist((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const toggleDone = (id: string) => {
    setChecklist((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        if ((x.type ?? "task") === "group") return x;

        const nextDone = !x.done;
        const next: ChecklistItem = { ...x, done: nextDone, status: nextDone ? "normal" : x.status };

        if (nextDone) resolveParked(next, "done");
        else reopenIfDoneResolved(next);

        return next;
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

  const reviveParkedToStage = (p: ParkedItem) => {
    snapshotStage();

    const exists = checklist.some((x) => itemKey(x.text, x.category) === p.key);
    if (!exists) {
      const newItem: ChecklistItem = {
        id: uid(),
        text: toSuruForm(p.text),
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
    showToast("このStageに復帰した");
  };

  const analyze = async () => {
    setError("");
    if (!draft.trim() && goals.filter((g) => g.trim()).length === 0 && checklist.filter((x) => x.text.trim()).length === 0) {
      showToast("下書きかゴールかToDoを入れてね");
      return;
    }

    try {
      const hint = `
以下のユーザー入力を「構造文法」で整理して、行動に落とすための材料を出して。
出力は Markdown。

【1. 気持ち/現状/なぜ（1〜3行）】
【2. ゴール（1行）】
【3. 完了条件（チェック式：3〜5個）】
【4. 分解（最大10個。カテゴリごとに）】
- カテゴリは [カテゴリ名] で囲む
- タスクは箇条書き（- ）
- 各タスクは「〜する」で終える
`.trim();

      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          goals: goals.filter((g) => g.trim()),
          checklist: checklist.map((x) => ({ text: x.text, done: x.done, category: x.category })),
          hint,
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

      if (!text.trim()) throw new Error("結果が空だった…");

      setAiResult(text);
      showToast("分析した");
    } catch (e: any) {
      setError(`分析でエラー：${String(e?.message ?? e)}`);
    }
  };

  const breakDownOne = async (itemId: string) => {
    setError("");
    const target = checklist.find((x) => x.id === itemId);
    if (!target) return;
    if ((target.type ?? "task") === "group") return;
    if (!target.text.trim()) {
      showToast("まずテキストを入れてね");
      return;
    }

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

    const cleaned = sanitizeAnalysis(aiResult);
    const cands = extractActionCandidates(cleaned);
    const used = new Set(usedActionKeys.map((x) => x.toLowerCase()));

    const available: { category: string; action: string }[] = [];
    const seen = new Set<string>();
    for (const c of cands) {
      const k = c.action.toLowerCase();
      if (used.has(k)) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      available.push(c);
    }

    if (available.length === 0) {
      showToast("次のToDoがもうない。下書きを足して分析し直すか、「さらに分解」で増やしてね");
      return;
    }

    snapshotStage();

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

    setArchivedCreated((v) => v + totalTasks);
    setArchivedDone((v) => v + doneTasks);

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

    const nextPack = picked.slice(0, 5);

    const nextTodos: ChecklistItem[] = nextPack.map((p) => ({
      id: uid(),
      text: toSuruForm(p.action),
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
    showToast("プロンプトを生成した");
  };

  const copyIssuedPrompt = async () => {
    if (!issuedPrompt.trim()) {
      showToast("先にプロンプトを生成してね");
      return;
    }
    try {
      await navigator.clipboard.writeText(issuedPrompt);
      showToast("コピーした");
    } catch {
      showToast("コピーできなかった");
    }
  };

  const goBack = () => router.push("/lists");

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={goBack}>
          ← Lists
        </button>

        <div className={styles.titleWrap}>
          <div className={styles.title}>{list?.title || "List"}</div>
          <div className={styles.meta}>
            Stage {stage || 1} / 進捗 {progressPct}%（{doneTasks}/{totalTasks}）
          </div>
        </div>

        <div className={styles.topActions}>
          <button className={styles.ghostBtn} onClick={clearAll}>
            リセット
          </button>
        </div>
      </div>

      {toast ? <div className={styles.toast}>{toast}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>ゴール</div>
          <div className={styles.cardBody}>
            {goals.length === 0 ? <div className={styles.muted}>（未設定）</div> : null}

            {goals.map((g, i) => (
              <div className={styles.goalRow} key={i}>
                <input
                  className={styles.input}
                  value={g}
                  onChange={(e) => updateGoal(i, e.target.value)}
                  placeholder="例：今週中にショップの新商品を3点登録する"
                />
                <button className={styles.ghostBtn} onClick={() => removeGoal(i)}>
                  ✕
                </button>
              </div>
            ))}

            <button className={styles.btn} onClick={addGoal}>
              + ゴール追加
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>下書き（状況メモ）</div>
          <div className={styles.cardBody}>
            <textarea
              className={styles.textarea}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="状況、気持ち、制約、手元の情報など。雑に書いてOK。"
            />
          </div>
        </div>

        <div className={styles.cardWide}>
          <div className={styles.cardTitleRow}>
            <div className={styles.cardTitle}>ToDo</div>
            <div className={styles.rightMeta}>
              全体 {overallPct}% / 残り見込み {remainingExpected} / 次候補 {nextCandidateRemaining}
            </div>
          </div>

          <div className={styles.cardBody}>
            <div className={styles.todoTopRow}>
              <button className={styles.btn} onClick={addItem}>
                + ToDo追加
              </button>
              <button className={styles.btnSecondary} onClick={analyze}>
                分析（AI）
              </button>
              <button className={styles.btnSecondary} onClick={generateNextStage} disabled={!hasNextCandidates || !canGenerateNextStage}>
                次ステージ生成
              </button>
            </div>

            <div className={styles.list}>
              {checklist.length === 0 ? <div className={styles.muted}>まだToDoがない</div> : null}

              {checklist.map((it) => {
                const depth = it.depth ?? 0;
                const isGroup = (it.type ?? "task") === "group";
                const isTask = !isGroup;

                const status = it.status ?? "normal";
                const isUnknown = status === "unknown";
                const isLater = status === "later";

                return (
                  <div className={styles.item} key={it.id} style={{ marginLeft: depth * 14 }}>
                    <div className={styles.itemLeft}>
                      {isTask ? (
                        <input
                          type="checkbox"
                          checked={it.done}
                          onChange={() => toggleDone(it.id)}
                          className={styles.checkbox}
                        />
                      ) : (
                        <div className={styles.groupDot}>◼︎</div>
                      )}

                      <input
                        className={`${styles.itemText} ${isGroup ? styles.groupText : ""}`}
                        value={it.text}
                        onChange={(e) => updateItem(it.id, { text: e.target.value })}
                        placeholder={isGroup ? "グループ（親）" : "例：写真を撮る"}
                      />

                      <input
                        className={styles.itemCategory}
                        value={it.category}
                        onChange={(e) => updateItem(it.id, { category: e.target.value })}
                        placeholder="カテゴリ"
                      />
                    </div>

                    <div className={styles.itemRight}>
                      {isTask ? (
                        <>
                          <button className={`${styles.pill} ${isUnknown ? styles.pillOn : ""}`} onClick={() => setUnknown(it.id)}>
                            ? わからない
                          </button>
                          <button className={`${styles.pill} ${isLater ? styles.pillOn : ""}`} onClick={() => setLater(it.id)}>
                            ⏳ あとまわし
                          </button>

                          <button
                            className={styles.pill}
                            onClick={() => breakDownOne(it.id)}
                            disabled={busyItemId === it.id}
                            title="この1件をAIでさらに分解"
                          >
                            {busyItemId === it.id ? "分解中…" : "さらに分解"}
                          </button>
                        </>
                      ) : null}

                      <button className={styles.ghostBtn} onClick={() => deleteItem(it.id)}>
                        削除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.cardWide}>
          <div className={styles.cardTitleRow}>
            <div className={styles.cardTitle}>分析（AIの出力）</div>
            <div className={styles.rightMeta}>{aiResult.trim() ? `${aiResult.split("\n").length} lines` : ""}</div>
          </div>

          <div className={styles.cardBody}>
            <textarea
              className={styles.textarea}
              value={aiResult}
              onChange={(e) => setAiResult(e.target.value)}
              placeholder="ここに分析結果が入る"
            />

            <div className={styles.promptOptions}>
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={includeDraftInPrompt} onChange={(e) => setIncludeDraftInPrompt(e.target.checked)} />
                下書きを含める
              </label>
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={includeAnalysisInPrompt} onChange={(e) => setIncludeAnalysisInPrompt(e.target.checked)} />
                分析を含める
              </label>

              <button className={styles.btnSecondary} onClick={generateIssuedPrompt}>
                バトンパス用プロンプト生成
              </button>
              <button className={styles.btnSecondary} onClick={copyIssuedPrompt}>
                コピー
              </button>
            </div>

            {issuedPrompt.trim() ? (
              <div className={styles.issuedWrap}>
                <div className={styles.miniTitle}>発行済みプロンプト</div>
                <pre className={styles.pre}>{issuedPrompt}</pre>
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.cardWide}>
          <div className={styles.cardTitleRow}>
            <div className={styles.cardTitle}>保留ボード</div>
            <div className={styles.rightMeta}>
              未解決 {parkedUnresolved.length} / 解決済み {parkedResolved.length}
            </div>
          </div>

          <div className={styles.cardBody}>
            {parkedUnresolved.length === 0 ? <div className={styles.muted}>保留なし</div> : null}

            {parkedUnresolved.map((p) => (
              <div className={styles.parkRow} key={p.key}>
                <div className={styles.parkText}>
                  <div className={styles.parkMain}>{p.text}</div>
                  <div className={styles.parkMeta}>
                    {p.category} / status:{p.status} / stage:{p.stage}
                  </div>
                </div>
                <div className={styles.parkActions}>
                  <button className={styles.btnSecondary} onClick={() => reviveParkedToStage(p)}>
                    このStageに復帰
                  </button>
                  <button className={styles.ghostBtn} onClick={() => resolveParkedByKey(p.key, "cleared")}>
                    クリア
                  </button>
                </div>
              </div>
            ))}

            {parkedResolved.length > 0 ? (
              <details className={styles.details}>
                <summary>解決済み（{parkedResolved.length}）</summary>
                <div className={styles.resolvedList}>
                  {parkedResolved.map((p) => (
                    <div className={styles.resolvedRow} key={p.key}>
                      <div className={styles.resolvedText}>
                        {p.text} <span className={styles.muted}>({p.resolution})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>

        <div className={styles.cardWide}>
          <div className={styles.cardTitleRow}>
            <div className={styles.cardTitle}>スナップショット</div>
            <div className={styles.rightMeta}>{stageHistory.length}件</div>
          </div>

          <div className={styles.cardBody}>
            {stageHistory.length === 0 ? <div className={styles.muted}>まだない</div> : null}

            <div className={styles.snapList}>
              {stageHistory.map((s) => (
                <div className={styles.snapRow} key={s.createdAt}>
                  <div className={styles.snapText}>
                    <div className={styles.snapMain}>Stage {s.stage}</div>
                    <div className={styles.snapMeta}>{new Date(s.createdAt).toLocaleString()}</div>
                  </div>
                  <div className={styles.snapActions}>
                    <button className={styles.btnSecondary} onClick={() => restoreSnapshot(s)}>
                      戻す
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.footerNote}>
              <Link href="/help" className={styles.link}>
                使い方
              </Link>
              <span className={styles.dot}>·</span>
              <Link href="/concept" className={styles.link}>
                Concept
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
