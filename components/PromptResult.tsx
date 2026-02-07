"use client";

import CopyButtons from "@/components/CopyButtons";

function normalizeChecklist(input: string[] | string) {
  const arr = Array.isArray(input) ? input : input.split("\n");
  return arr
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^- \[ \]\s*/, "").replace(/^- \[\]\s*/, "").replace(/^- /, ""));
}

type Props = {
  prompt: string;
  checklist: string[] | string;
};

export default function PromptResult({ prompt, checklist }: Props) {
  const list = normalizeChecklist(checklist);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Prompt</h2>
        <pre className="whitespace-pre-wrap rounded-md border p-3 text-sm">
          {prompt || "(まだ生成されてない)"}
        </pre>
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Checklist</h2>
        {list.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {list.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm opacity-70">(まだ生成されてない)</p>
        )}
      </div>

      <CopyButtons prompt={prompt ?? ""} checklist={list} />
    </section>
  );
}
