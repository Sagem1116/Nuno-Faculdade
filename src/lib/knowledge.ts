// Helpers to turn TipTap JSON / DB rows into plain text the AI can read.

export function tiptapText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(tiptapText).join("\n");
  if (typeof node !== "object") return "";
  const n = node as { text?: string; title?: string; content?: unknown };
  let out = "";
  if (typeof n.title === "string" && n.title.trim()) out += "\n# " + n.title + "\n";
  if (typeof n.text === "string") out += n.text + " ";
  if (n.content) out += tiptapText(n.content);
  return out;
}

export function truncate(s: string, max = 3500): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}