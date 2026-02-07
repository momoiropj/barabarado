"use client";

import { useState } from "react";
import { buildMarkdown } from "@/lib/markdown";

type Props = {
  prompt: string;
  checklist: string[];
};

export default function CopyButtons({ prompt, checklist }: Props) {
  const [msg, setMsg] = useState("");

  const safeCopy = async (text: string, doneMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(doneMsg);
      setTimeout(() => setMsg(""), 1200);
    } catch {
      setMsg("コピー失敗（HTTPS/権限を確認）");
      setTimeout(() => setMsg(""), 1800);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => safeCopy(prompt, "Promptコピーした")}
      >
        Copy Prompt
      </button>

      <button
        type="button"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => safeCopy(buildMarkdown(prompt, checklist), "Markdownコピーした")}
      >
        Copy All (Markdown)
      </button>

      {msg ? <span className="text-xs opacity-70">{msg}</span> : null}
    </div>
  );
}
