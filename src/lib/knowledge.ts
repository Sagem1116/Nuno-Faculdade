// Helpers to turn TipTap JSON / DB rows into plain text the AI can read.

export function tiptapText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[] };
  let out = "";
  if (typeof n.text === "string") out += n.text + " ";
  if (Array.isArray(n.content)) out += n.content.map(tiptapText).join(" ");
  return out;
}

export function truncate(s: string, max = 3500): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}