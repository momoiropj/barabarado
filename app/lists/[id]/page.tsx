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

  note?: string;
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

  note?: string;
};

type SavedDetail = {
  draft: string;
  aiResult: string;
  goals: string[];

  checklist: ChecklistItem[];
  stage: number;

  usedActionKeys: string[];
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

  if (s.endsWith("します")) s = s.replace(/します$/, "する");

  s = s.replace(/(る|う|く|ぐ|す|つ|ぬ|ぶ|む)\s*する$/, "$1");
  s = s.replace(/する\s*する$/, "する");

  return s.trim();
}

function itemKey(text: string, category: string) {
  return `${normalizeLine(category)}||${normalizeLine(text)}`.toLowerCase();
}

function loadDetail(listId: string): SavedDetail {
  const key = `${DETAIL_KEY_PREFIX}${listId}`;
  const parsed = safeParseJSON<any>(localStorage.getItem(key));
  const now = new Date().toISOString();

  const normalizeChecklist = (arr: any[] | undefined): ChecklistItem[] => {
    if (!Array.isArray(arr)) return [];

    return arr
      .map((x: any): ChecklistItem => {
        const depthNum = Number(x?.depth);
        const createdAt = typeof x?.createdAt === "string" ? x.createdAt : undefined;

        const type: ChecklistItem["type"] = x?.type === "group" ? "group" : "task";

        const status: ChecklistItem["status"] =
          x?.status === "unknown" ? "unknown" : x?.status === "later" ? "later" : "normal";

        const note = typeof x?.note === "string" ? x.note : "";

        return {
          id: String(x?.id ?? uid()),
          text: String(x?.text ?? ""),
          done: Boolean(x?.done ?? false),
          category: String(x?.category ?? "未分類"),
          createdAt,
          type,
          depth: Number.isFinite(depthNum) ? depthNum : 0,
          status,
          note,
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
          note: typeof p?.note === "string" ? p.note : "",
        };
      })
      .filter((p) => p.key && p.text);
  };

  return {
    draft: String(parsed?.draft ?? ""),
    aiResult: String(parsed?.aiResult ?? ""),
    goals: Array.isArray(parsed?.goals) ? parsed.goals.map((g: any) => String(g)) : [],
    checklist: normalizeChecklist(parsed?.checklist),
    stage: Number(parsed?.stage ?? 0) || 0,
    usedActionKeys: Array.isArray(parsed?.usedActionKeys) ? parsed.usedActionKeys.map((x: any) => String(x)) : [],
    issuedPrompt: String(parsed?.issuedPrompt ?? ""),
    archivedCreated: Number(parsed?.archivedCreated ?? 0) || 0,
    archivedDone: Number(parsed?.archivedDone ?? 0) || 0,
    parked: normalizeParked(parsed?.parked),
    updatedAt: String(parsed?.updatedAt ?? now),
  };
}

function saveDetail(listId: string, detail: SavedDetail) {
  const key = `${DETAIL_KEY_PREFIX}${listId}`;
  localStorage.setItem(key, JSON.stringify(detail));
}

function sanitizeAnalysis(raw: string): string {
  const text = raw.trim();
  if (!text) return "";

  const idx3 = text.search(/【\s*3[\.\s]*完了条件/);
  const idx4 = text.search(/【\s*4[\.\s]*分解/);

  if (idx3 >= 0) return text.slice(idx3).trim();
  if (idx4 >= 0) return text.slice(idx4).trim();
  return text;
}

function extractBreakdownSection(text: string): string {
  const raw = (text ?? "").trim();
  if (!raw) return "";

  const lines = raw.split("\n");
  const start = lines.findIndex((l) => /【\s*4[\.\s]*分解/.test(l.trim()));
  if (start < 0) {
    return raw;
  }

  const tail = lines.slice(start + 1);
  const endRel = tail.findIndex((l) => {
    const t = l.trim();
    return /^【\s*[0-9]/.test(t) && !/【\s*4[\.\s]*分解/.test(t);
  });
  const end = endRel >= 0 ? start + 1 + endRel : lines.length;

  return lines.slice(start, end).join("\n").trim();
}

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
    const trimmedRaw = raw.trim();

    if (/^-+\s*\[\s*[xX ]?\s*\]\s*/.test(trimmedRaw) && !/L3[:：]/.test(trimmedRaw)) {
      continue;
    }

    const mdHead = line.match(/^#{2,6}\s*(.+)$/);
    if (mdHead?.[1]) {
      currentL1 = normalizeLine(mdHead[1]) || currentL1 || "未分類";
      continue;
    }

    const plainCat = line.match(/^(目的|予算感|準備|段取り)\s*$/);
    if (plainCat?.[1]) {
      currentL1 = plainCat[1];
      continue;
    }

    const inlineCat = line.match(/^(目的|予算感|準備|段取り)\s*[:：]\s*(.+)$/);
    if (inlineCat?.[1] && inlineCat?.[2]) {
      push(inlineCat[1], inlineCat[2]);
      continue;
    }

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

function scoreMicroAction(action: string): number {
  const a = action.trim();
  const len = a.length;

  const hasNumber = /[0-9０-９]/.test(a) || /(一|二|三|四|五|六|七|八|九|十|3つ|5分|10分|15分|20分)/.test(a);
  const hasTime = /(分|時間|今日|今|すぐ|まず)/.test(a);

  const concreteNouns =
    /(書類|レシート|領収書|請求書|メール|アプリ|サイト|ページ|URL|リンク|フォルダ|箱|机|引き出し|スマホ|PC|ブラウザ|ログイン|ID|パスワード|カード|メモ|紙)/;
  const hasConcrete = concreteNouns.test(a);

  const strongVerbs =
    /(開く|ログイン|探す|見つける|取り出す|出す|並べる|仕分ける|写真|撮る|印刷|保存|コピー|貼る|入力|書く|メモ|チェック|確認|選ぶ|決める|用意|作る|申請|提出|ダウンロード|インストール)/;
  const hasStrong = strongVerbs.test(a);

  const vagueVerbs = /(まとめる|整理する|洗い出す|把握する|検討する|調べる|言語化する|考える|理解する|計画する|準備する)/;
  const hasVague = vagueVerbs.test(a);

  let score = 0;

  if (hasStrong) score += 6;
  if (hasConcrete) score += 5;
  if (hasNumber) score += 3;
  if (hasTime) score += 1;

  if (hasVague && !hasConcrete) score -= 5;
  if (hasVague && hasConcrete) score -= 1;

  if (len >= 30) score -= 3;
  if (len >= 45) score -= 6;

  if (/について(調べる|検討する|考える)$/.test(a)) score -= 6;

  return score;
}

function contentAwareFallback(_cleaned: string): { category: string; action: string }[] {
  return [
    { category: "目的", action: "理想の完了状態を1文で書く" },
    { category: "段取り", action: "進め方のルートを選ぶ（自力/外注、オンライン/対面など）" },
    { category: "準備", action: "関連しそうな物や情報がありそうな場所を1か所決める" },
    { category: "予算感", action: "上限予算を仮で決める（0円でもOK）" },
    { category: "段取り", action: "タイマーを5分にして最初の1つだけ着手する" },
  ].map((x) => ({ ...x, action: normalizeTodoText(x.action) }));
}

function pickInitial5FromAnalysis(aiRaw: string): ChecklistItem[] {
  const cleaned = sanitizeAnalysis(aiRaw);
  const onlyBreakdown = extractBreakdownSection(cleaned);
  const cands = extractActionCandidates(onlyBreakdown);

  const scored = cands
    .map((c) => ({
      category: c.category || "未分類",
      action: normalizeTodoText(c.action),
      score: scoreMicroAction(normalizeTodoText(c.action)),
    }))
    .filter((x) => x.action);

  scored.sort((a, b) => b.score - a.score);

  const picked: { category: string; action: string }[] = [];
  const usedAction = new Set<string>();

  const mustCats = ["目的", "予算感", "準備", "段取り"];

  for (const cat of mustCats) {
    const best = scored.find(
      (x) => x.category.toLowerCase() === cat.toLowerCase() && !usedAction.has(x.action.toLowerCase())
    );
    if (best) {
      picked.push({ category: best.category, action: best.action });
      usedAction.add(best.action.toLowerCase());
    }
  }

  for (const s of scored) {
    if (picked.length >= 5) break;
    const k = s.action.toLowerCase();
    if (usedAction.has(k)) continue;
    picked.push({ category: s.category, action: s.action });
    usedAction.add(k);
  }

  if (picked.length < 5) {
    const fb = contentAwareFallback(cleaned);
    for (const f of fb) {
      if (picked.length >= 5) break;
      const k = f.action.toLowerCase();
      if (usedAction.has(k)) continue;
      picked.push({ category: f.category, action: normalizeTodoText(f.action) });
      usedAction.add(k);
    }
  }

  const base = picked.length ? picked.slice(0, 5) : contentAwareFallback(cleaned).slice(0, 5);

  return base.map((p) => ({
    id: uid(),
    text: normalizeTodoText(p.action),
    done: false,
    category: p.category || "未分類",
    createdAt: new Date().toISOString(),
    type: "task",
    depth: 0,
    status: "normal",
    note: "",
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
      const note = (it.note || "").trim();
      const notePart = note ? ` / 追記: ${note.replace(/\n/g, " ")}` : "";
      return `- [${it.done ? "x" : " "}] [${it.category || "未分類"}] ${st}${it.text}${notePart}`;
    })
    .join("\n");
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

  const parts: string[] = [];
  parts.push(`# BarabaraDo バトンパスプロンプト（貼り付け専用）`);
  parts.push("");
  parts.push(`あなたは「実行に強いToDo分解コーチ」。`);
  parts.push(
    `ユーザーが BarabaraDo で作った素材（ToDo/下書き/チェックリスト）を受け取って、**次に何をすれば進むか**を決めさせ、必要ならチェックリストをユーザーに合わせて改造して前に進める。`
  );
  parts.push("");
  parts.push("---");
  parts.push("");
  parts.push(`## 入力（BarabaraDoからの引き継ぎ）`);
  if (includeDraft) {
    parts.push(`- **下書き**: ${draft.trim() ? draft.trim().replace(/\n/g, " / ") : "（なし）"}`);
  }
  if (includeAnalysis) {
    parts.push(`- **AI分析（要約）**: ${aiResult.trim() ? "あり" : "（なし）"}`);
  }
  parts.push(`- **Stage**: ${stage || 1}`);
  parts.push("");
  parts.push(`## 目指すゴール（完了条件）`);
  parts.push(goalsToMarkdown(goals));
  parts.push("");
  parts.push(`## 現在のToDoチェックリスト（追記つき）`);
  parts.push(checklistToMarkdown(checklist));
  parts.push("");
  parts.push(`---`);
  parts.push("");
  parts.push(`## あなたの最初の返答（必須・この1行で開始）`);
  parts.push(`**「OK，BarabaraDoからバトンパスされたよ！ここからは私がサポートするよ」**`);
  parts.push("");
  parts.push(`---`);
  parts.push("");
  parts.push(`## 進め方（ルール）`);
  parts.push(`- 抽象論で終わらせない。**必ず“行動”に落とす**（何を・いつ・どこで・どうやって）。`);
  parts.push(`- ユーザーが迷っているなら、**次の5分の行動**を決めさせる。`);
  parts.push(`- ToDoが大きい/曖昧なら、**追加の質問**で具体化してから分解する。`);
  parts.push(`- 出力は、ユーザーがコピペしやすいチェックリスト形式を優先する。`);

  return parts.join("\n");
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yy}-${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return iso;
  }
}

async function copyText(text: string, onOk?: string) {
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true, msg: onOk || "コピーした" };
  } catch {
    return { ok: false, msg: "コピーできなかった（権限ブロックかも）" };
  }
}

export default function ListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listId = String((params as any)?.id ?? "");

  const [list, setList] = useState<ListRow | null>(null);

  const [draft, setDraft] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [stage, setStage] = useState(0);

  const [usedActionKeys, setUsedActionKeys] = useState<string[]>([]);
  const [issuedPrompt, setIssuedPrompt] = useState("");

  const [archivedCreated, setArchivedCreated] = useState(0);
  const [archivedDone, setArchivedDone] = useState(0);

  const [parked, setParked] = useState<ParkedItem[]>([]);

  const [busy, setBusy] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [toast, setToast] = useState("");

  const [includeDraftInPrompt, setIncludeDraftInPrompt] = useState(true);
  const [includeAnalysisInPrompt, setIncludeAnalysisInPrompt] = useState(true);

  const issuedPromptRef = useRef<HTMLTextAreaElement | null>(null);

  const [newTodoText, setNewTodoText] = useState("");
  const [newTodoCategory, setNewTodoCategory] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1600);
  };

  useEffect(() => {
    const lists = loadGuestLists();
    const found = lists.find((l) => l.id === listId) || null;
    setList(found);

    const detail = loadDetail(listId);

    setDraft(detail.draft || "");
    setAiResult(detail.aiResult || "");
    setGoals(Array.isArray(detail.goals) ? detail.goals : []);
    setChecklist(Array.isArray(detail.checklist) ? detail.checklist : []);
    setStage(Number(detail.stage || 0) || 0);
    setUsedActionKeys(Array.isArray(detail.usedActionKeys) ? detail.usedActionKeys : []);
    setIssuedPrompt(String(detail.issuedPrompt || ""));

    setArchivedCreated(Number(detail.archivedCreated || 0) || 0);
    setArchivedDone(Number(detail.archivedDone || 0) || 0);
    setParked(Array.isArray(detail.parked) ? detail.parked : []);
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
      issuedPrompt,
      archivedCreated,
      archivedDone,
      parked,
      updatedAt: new Date().toISOString(),
    };
    saveDetail(listId, detail);

    const lists = loadGuestLists();
    const idx = lists.findIndex((l) => l.id === listId);
    if (idx >= 0) {
      lists[idx] = {
        ...lists[idx],
        title: lists[idx].title || list?.title || "リスト",
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(GUEST_LISTS_KEY, JSON.stringify(lists));
    }
  }, [
    listId,
    draft,
    aiResult,
    goals,
    checklist,
    stage,
    usedActionKeys,
    issuedPrompt,
    archivedCreated,
    archivedDone,
    parked,
    list?.title,
  ]);

  const clearAll = () => {
    setDraft("");
    setAiResult("");
    setGoals([]);
    setChecklist([]);
    setStage(0);
    setUsedActionKeys([]);
    setIssuedPrompt("");
    setArchivedCreated(0);
    setArchivedDone(0);
    setParked([]);
    showToast("リセットした");
  };

  const toggleDone = (id: string) => {
    setChecklist((prev) => prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  };

  const setNote = (id: string, note: string) => {
    setChecklist((prev) => prev.map((x) => (x.id === id ? { ...x, note } : x)));
  };

  const deleteItem = (id: string) => {
    const target = checklist.find((x) => x.id === id);
    setChecklist((prev) => prev.filter((x) => x.id !== id));

    if (target) {
      const key = itemKey(target.text, target.category);
      setParked((prev) => {
        const idx = prev.findIndex((p) => p.key === key);
        if (idx < 0) return prev;
        const cur = prev[idx];
        if (cur.resolvedAt) return prev;
        const now = new Date().toISOString();
        const next = [...prev];
        next[idx] = { ...cur, updatedAt: now, resolvedAt: now, resolution: "deleted" };
        return next;
      });
    }

    showToast("削除した");
  };

  const addManualTodo = () => {
    const text = normalizeTodoText(newTodoText);
    if (!text) {
      showToast("ToDoが空だよ");
      return;
    }
    const category = newTodoCategory.trim() || "未分類";

    const item: ChecklistItem = {
      id: uid(),
      text,
      done: false,
      category,
      createdAt: new Date().toISOString(),
      type: "task",
      depth: 0,
      status: "normal",
      note: "",
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

  const l3Count = useMemo(() => {
    if (!aiResult.trim()) return 0;
    const cleaned = sanitizeAnalysis(aiResult);
    return extractActionCandidates(extractBreakdownSection(cleaned)).length;
  }, [aiResult]);

  const nextCandidateRemaining = useMemo(() => {
    if (!aiResult.trim()) return 0;
    const cleaned = sanitizeAnalysis(aiResult);
    const cands = extractActionCandidates(extractBreakdownSection(cleaned));

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
          note: it.note || "",
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
        note: it.note || cur.note || "",
      };
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

  const toggleUnknown = (id: string) => {
    setChecklist((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        const nextStatus: ItemStatus = x.status === "unknown" ? "normal" : "unknown";
        const nextDone = nextStatus === "unknown" ? false : x.done;
        return { ...x, status: nextStatus, done: nextDone };
      })
    );

    const it = checklist.find((x) => x.id === id);
    if (it) upsertParked(it, "unknown");

    showToast("「わからない」を切り替えた");
  };

  const toggleLater = (id: string) => {
    setChecklist((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        const nextStatus: ItemStatus = x.status === "later" ? "normal" : "later";
        const nextDone = nextStatus === "later" ? false : x.done;
        return { ...x, status: nextStatus, done: nextDone };
      })
    );

    const it = checklist.find((x) => x.id === id);
    if (it) upsertParked(it, "later");

    showToast("「あとまわし」を切り替えた");
  };

  const reviveParkedToStage = (p: ParkedItem) => {
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
        note: p.note || "",
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
  【3. 完了条件（目指すゴール）】…チェック式 "- [ ]" で3〜5個（ToDoと同じ文を入れない）
  【4. 分解（L1→L2→L3）】…L1はカテゴリ / L3は具体アクション

【重要：カテゴリ設計（必須）】
- L1 は最低でも次の4つを必ず含む：目的 / 予算感 / 準備 / 段取り
- 必要なら追加カテゴリOK（最大6）
- 各L1の最初のL2は必ず「最初の一歩（5〜15分）」にする
- 各L2の下に L3 を1〜3行は必ず出す
- L3 は必ず行頭に "L3:" を付ける（抽出のため）

【最初の5つのToDoの作り方（最重要）】
- 最初の一歩は「机に座って3分で手が動くレベル」に落とす
- 抽象語だけのToDoは禁止（例：整理する / まとめる / 調べる / 検討する / 言語化する）
  - 代わりに「何をどうする」を書く（例：アプリを開く / 書類を1か所に集める / 検索キーワードを3つ書く）
- 分岐がある作業は、最初に「ルートを選ぶ」を必ず入れる（例：オンライン/対面、自力/外注、公式手順/代替）
- 情報が足りない場合は、仮定を置く：
  - L3には仮定を書かない（タスクだけにする）
  - 仮定はL2の補足行として "前提:" で書き、文末は「前提」で止める（動詞で終えない）

【予算感（一般論の提示）】
- 予算の参考は、L2の補足として "参考:" を付けて箇条書きで書く
- 文末は「目安」か「円程度」で止める（動詞で終えない）
- その上で、L3では「上限予算を仮で決める」「外注するか決める」など、意思決定の一歩にする

【日本語のルール】
- 「すべて“〜する”で終わる」強制はしない。自然な動詞で終える（決める/買う/書く/まとめる/確認する 等）
- 「決めるする」みたいな不自然語尾は禁止
- 質問形は禁止（？を出さない）
- 余計な前置き・長い注意書き・自分語りは禁止（いきなり本文）
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

      const cleaned = sanitizeAnalysis(text);
      setAiResult(cleaned);

      const initial5 = pickInitial5FromAnalysis(cleaned);

      const newGoalsRaw = extractGoalsFromCompletion(cleaned);
      const todoLike = new Set<string>(
        [...checklist.map((x) => normalizeLine(x.text)), ...initial5.map((x) => normalizeLine(x.text))].filter(Boolean)
      );
      const newGoals = newGoalsRaw.filter((g) => !todoLike.has(normalizeLine(g)));
      setGoals(newGoals);

      if (wasEmpty) {
        setArchivedCreated(0);
        setArchivedDone(0);
        setParked([]);

        setChecklist(initial5);
        setStage(1);
        setUsedActionKeys(initial5.map((x) => x.text));

        showToast("分析→ゴール→最初のToDo5つを作った");
      } else {
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

  function extractSubTasks(text: string): string[] {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const out: string[] = [];
    for (const raw of lines) {
      const line = raw.replace(/^[-*•]\s*/, "");
      const m = line.match(/^-?\s*\[\s*[xX ]?\s*\]\s*(.+)$/);
      const body = normalizeTodoText(m?.[1] ?? line);
      if (!body) continue;
      if (body.includes("？") || body.includes("?")) continue;
      uniquePush(out, body);
    }
    return out.slice(0, 12);
  }

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
- 1行1タスク。抽象語（整理する/まとめる/調べる/検討する）だけは禁止
- 代わりに「何をどうする」まで書く（例：アプリを開く、検索キーワードを3つ書く、書類を1か所に集める）
`.trim();

      // ✅ TypeScript厳格対策：noteを一回string化してから使う
      const noteText = (target.note ?? "").trim();
      const noteBlock = noteText ? `\n\n追記（ユーザーの追加情報）:\n${noteText}\n` : "";

      const res = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          todo: target.text,
          context: `${SUBTASK_HINT}${noteBlock}\n\n---\n参考ゴール:\n${goals.join("\n")}\n\n参考メモ:\n${draft}`,
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
          note: "",
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
    const cands = extractActionCandidates(extractBreakdownSection(cleaned));
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
              note: t.note || "",
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
              note: t.note || cur.note || "",
            };
          }
        }
        return next;
      });
    }

    setArchivedCreated((v) => v + totalTasks);
    setArchivedDone((v) => v + doneTasks);

    const scored = available
      .map((a) => ({ ...a, score: scoreMicroAction(a.action) }))
      .sort((x, y) => y.score - x.score);

    const picked: { category: string; action: string }[] = [];
    const usedCat = new Set<string>();

    for (const c of scored) {
      if (picked.length >= 5) break;
      const catKey = (c.category || "未分類").toLowerCase();
      if (usedCat.has(catKey)) continue;
      picked.push({ category: c.category || "未分類", action: c.action });
      usedCat.add(catKey);
    }

    for (const c of scored) {
      if (picked.length >= 5) break;
      if (picked.some((p) => p.action.toLowerCase() === c.action.toLowerCase())) continue;
      picked.push({ category: c.category || "未分類", action: c.action });
    }

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
      note: "",
    }));

    setChecklist(nextTodos);
    setStage((s) => (s >= 1 ? s + 1 : 2));

    setUsedActionKeys((prev) => {
      const next = [...prev];
      for (const it of nextTodos) uniquePush(next, it.text);
      return next;
    });

    const remainingAfter = Math.max(available.length - nextTodos.length, 0);
    showToast(
      remainingAfter === 0
        ? `次のToDoを${nextTodos.length}個作った（これで最後）`
        : `次のToDoを${nextTodos.length}個作った（残り候補 ${remainingAfter}）`
    );
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
    copyText(p, "まとめてコピーした");
  };

  const topTitle = list?.title || "リスト";
  const lastUpdated = useMemo(() => {
    const d = loadDetail(listId);
    return d.updatedAt ? formatDateTime(d.updatedAt) : "";
  }, [
    listId,
    draft,
    aiResult,
    goals,
    checklist,
    stage,
    usedActionKeys,
    issuedPrompt,
    archivedCreated,
    archivedDone,
    parked,
  ]);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <button className={styles.backBtn} onClick={() => router.push("/lists")}>
            ← リスト一覧
          </button>

          <div className={styles.headerRight}>
            <div className={styles.badges}>
              <span className={styles.badge}>Stage: {stage || 0}</span>
              <span className={styles.badge}>進捗: {progressPct}%</span>
              <span className={styles.badge}>全体: {overallPct}%</span>
              <span className={styles.badge}>残り見込み: {remainingExpected}</span>
              <span className={styles.badge}>次候補: {nextCandidateRemaining}</span>
            </div>

            <nav className={styles.nav}>
              <Link className={styles.navLink} href="/concept">
                コンセプト
              </Link>
              <span className={styles.navSep}>/</span>
              <Link className={styles.navLink} href="/help">
                使い方
              </Link>
            </nav>
          </div>
        </div>

        <h1 className={styles.pageTitle}>{topTitle}</h1>
        <p className={styles.subtitle}>
          下書き→分析→ゴールと最初の5つ→チェックして次の5つ。<br />
          「わからない」「あとまわし」は保留ボードに集約される。
        </p>
      </header>

      <div className={styles.container}>
        {toast ? <div className={styles.toast}>{toast}</div> : null}

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>下書き（状況を書く）</h2>
            <span className={styles.mini}>最終更新: {lastUpdated || "—"}</span>
          </div>

          <p className={styles.p}>
            何が面倒か・どこが詰まってるか・ゴールは何か。雑でOK。ここが増えるほどAIが賢くなる（たぶん）。
          </p>

          <textarea
            className={styles.textarea}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={"例：やらなきゃいけないのに気が重い。何から手を付ければいいか分からない。資料や情報が散らばってる。"}
          />

          <div className={styles.row}>
            <button className={styles.btnPrimary} onClick={runAnalysis} disabled={busy}>
              {busy ? "分析中…" : "AIで分析"}
            </button>

            <button className={styles.btnDanger} onClick={clearAll} disabled={busy}>
              全リセット
            </button>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}

          <div className={styles.row}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={includeDraftInPrompt}
                onChange={(e) => setIncludeDraftInPrompt(e.target.checked)}
              />
              下書きをプロンプトに含める
            </label>

            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={includeAnalysisInPrompt}
                onChange={(e) => setIncludeAnalysisInPrompt(e.target.checked)}
              />
              AI分析をプロンプトに含める
            </label>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>目指すゴール（完了条件）</h2>
            <span className={styles.mini}>3〜5個</span>
          </div>

          {goals.length ? (
            <ul className={styles.goalList}>
              {goals.map((g) => (
                <li key={g} className={styles.goalItem}>
                  {g}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.pMuted}>まだゴールがない（AI分析すると入る）</p>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>手入力ToDo（消えない）</h2>
            <span className={styles.mini}>AI分析しても消さない</span>
          </div>

          <div className={styles.manualAdd}>
            <div className={styles.row}>
              <input
                className={styles.textInput}
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                placeholder="例：資料がありそうな箱を開ける"
              />
              <input
                className={styles.textInput}
                value={newTodoCategory}
                onChange={(e) => setNewTodoCategory(e.target.value)}
                placeholder="カテゴリ（任意）"
              />
              <button className={styles.btnPrimary} onClick={addManualTodo} disabled={busy}>
                追加
              </button>
            </div>
          </div>

          <p className={styles.pMuted}>
            ここで入れたToDoは守る。AI分析は「追加」しかしない（既存は消さない）。
          </p>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>ToDo（いまのStage）</h2>
            <span className={styles.mini}>
              {doneTasks}/{totalTasks} 完了
            </span>
          </div>

          {taskItems.length ? (
            <div className={styles.todoList}>
              {checklist.map((it) => {
                const isGroup = (it.type ?? "task") === "group";
                const isTask = !isGroup;
                const depth = it.depth ?? 0;
                const indentStyle = { marginLeft: `${Math.min(depth, 4) * 14}px` };

                return (
                  <div key={it.id} className={isGroup ? styles.todoGroup : styles.todoRow} style={indentStyle}>
                    <div className={styles.todoLeft}>
                      {isTask ? (
                        <input
                          type="checkbox"
                          checked={it.done}
                          onChange={() => toggleDone(it.id)}
                          className={styles.checkbox}
                        />
                      ) : (
                        <span className={styles.groupDot}>●</span>
                      )}

                      <span className={styles.cat}>{it.category || "未分類"}</span>

                      <span className={it.done ? styles.todoTextDone : styles.todoText}>{it.text}</span>

                      {it.status === "unknown" ? <span className={styles.tagUnknown}>わからない</span> : null}
                      {it.status === "later" ? <span className={styles.tagLater}>あとまわし</span> : null}

                      {isTask ? (
                        <input
                          className={styles.noteInput}
                          value={it.note ?? ""}
                          onChange={(e) => setNote(it.id, e.target.value)}
                          placeholder="追記（例：期限の希望 / 使いたい方法 / どこが不明か / 使える時間 など）"
                        />
                      ) : null}
                    </div>

                    <div className={styles.todoRight}>
                      {isTask ? (
                        <>
                          <button
                            className={styles.btnGhost}
                            onClick={() => decomposeTodo(it.id)}
                            disabled={busyItemId === it.id || busy}
                            title="このToDoをさらに分解"
                          >
                            {busyItemId === it.id ? "分解中…" : "さらに分解"}
                          </button>

                          <button className={styles.btnWarn} onClick={() => toggleUnknown(it.id)} disabled={busy}>
                            わからない
                          </button>

                          <button className={styles.btnWarn} onClick={() => toggleLater(it.id)} disabled={busy}>
                            あとまわし
                          </button>
                        </>
                      ) : null}

                      <button className={styles.btnDanger} onClick={() => deleteItem(it.id)} disabled={busy}>
                        削除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.pMuted}>まだToDoがない（AI分析で最初の5つが作られる）</p>
          )}

          <div className={styles.row}>
            <button
              className={hasNextCandidates ? styles.btnPrimary : styles.btnDisabled}
              onClick={generateNextStage}
              disabled={busy}
            >
              次の5つを作る
            </button>
            <span className={styles.mini}>
              条件：3つ完了 or 未完了2つ以下 / 残り候補 {nextCandidateRemaining}
            </span>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>保留ボード（わからない・あとまわし）</h2>
            <span className={styles.mini}>
              未解決 {parkedUnresolved.length} / 解決済み {parkedResolved.length}
            </span>
          </div>

          {parkedUnresolved.length ? (
            <div className={styles.parkList}>
              {parkedUnresolved.map((p) => (
                <div key={p.key} className={styles.parkRow}>
                  <div className={styles.parkLeft}>
                    <span className={styles.cat}>{p.category || "未分類"}</span>
                    <span className={styles.todoText}>{p.text}</span>
                    <span className={p.status === "unknown" ? styles.tagUnknown : styles.tagLater}>
                      {p.status === "unknown" ? "わからない" : "あとまわし"}
                    </span>
                    <span className={styles.mini}>（Stage {p.stage}）</span>

                    {p.note?.trim() ? <span className={styles.noteBadge}>追記あり</span> : null}
                  </div>

                  <div className={styles.parkRight}>
                    <button className={styles.btnPrimary} onClick={() => reviveParkedToStage(p)} disabled={busy}>
                      このStageに復帰
                    </button>
                    <button className={styles.btnGhost} onClick={() => resolveParkedByKey(p.key, "done")} disabled={busy}>
                      解決（完了）
                    </button>
                    <button
                      className={styles.btnDanger}
                      onClick={() => resolveParkedByKey(p.key, "cleared")}
                      disabled={busy}
                    >
                      クリア
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.pMuted}>保留はまだない</p>
          )}

          {parkedResolved.length ? (
            <>
              <p className={styles.p}>解決済み</p>
              <div className={styles.parkList}>
                {parkedResolved.map((p) => (
                  <div key={p.key} className={styles.parkRowResolved}>
                    <div className={styles.parkLeft}>
                      <span className={styles.cat}>{p.category || "未分類"}</span>
                      <span className={styles.todoTextDone}>{p.text}</span>
                      <span className={styles.mini}>
                        {p.resolution ? `（${p.resolution}）` : ""}{" "}
                        {p.resolvedAt ? formatDateTime(p.resolvedAt) : ""}
                      </span>
                      {p.note?.trim() ? <span className={styles.noteBadge}>追記あり</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>プロンプト発行（次チャット用）</h2>
            <span className={styles.mini}>コピペ用</span>
          </div>

          <p className={styles.pMuted}>チェックリスト・ゴール・追記も含めて、次チャットに渡せる。</p>

          <div className={styles.row}>
            <button className={styles.btnPrimary} onClick={generateIssuedPrompt} disabled={busy}>
              プロンプト発行
            </button>
            <button className={styles.btnGhost} onClick={copyPromptOnly} disabled={busy}>
              プロンプトだけコピー
            </button>
            <button className={styles.btnGhost} onClick={copyAll} disabled={busy}>
              まとめてコピー
            </button>
          </div>

          <textarea
            ref={issuedPromptRef}
            className={styles.textarea}
            value={issuedPrompt}
            onChange={(e) => setIssuedPrompt(e.target.value)}
            placeholder="ここに発行される"
          />
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>AI分析（表示）</h2>
            <span className={styles.mini}>抽出元（そのまま表示）</span>
          </div>

          {aiResult.trim() ? (
            <pre className={styles.pre}>{aiResult}</pre>
          ) : (
            <p className={styles.pMuted}>まだ分析がない</p>
          )}
        </section>
      </div>
    </main>
  );
}
