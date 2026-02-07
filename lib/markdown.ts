export function buildMarkdown(prompt: string, checklist: string[]) {
  const checklistMd = checklist.map((i) => `- [ ] ${i}`).join("\n");
  return `## Prompt\n${prompt}\n\n---\n\n## Checklist\n${checklistMd}\n`;
}
