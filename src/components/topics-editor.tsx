import { useEffect, useMemo, useRef, useState } from "react";
import { TiptapEditor } from "./tiptap-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight } from "lucide-react";
import { SortableList } from "@/components/sortable";
import { toast } from "sonner";

export type Topic = { id: string; title: string; content: unknown };

type Props = {
  value: unknown;
  onChange: (topics: Topic[]) => void;
  placeholder?: string;
  /** Used to label the first auto-migrated topic from legacy data. */
  legacyTitle?: string;
  /** Stable key used for localStorage autosave & recovery. */
  storageKey?: string;
};

const REFLECTION_KEYS: Record<string, string> = {
  learned: "O que aprendi hoje?",
  not_understood: "O que ainda não compreendi?",
  to_review: "O que devo rever?",
  connections: "Ligações com aulas anteriores",
  ideas: "Ideias e pensamentos pessoais",
};

function normalize(value: unknown, legacyTitle = ""): Topic[] {
  if (Array.isArray(value)) {
    const arr = value as Topic[];
    if (arr.length === 0) return [{ id: crypto.randomUUID(), title: "", content: null }];
    return arr.map((t) => ({
      id: t.id ?? crypto.randomUUID(),
      title: t.title ?? "",
      content: t.content ?? null,
    }));
  }
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    // TipTap doc → single topic
    if (v.type === "doc") {
      return [{ id: crypto.randomUUID(), title: legacyTitle, content: v }];
    }
    // Legacy ReflectionData → topics
    const topics: Topic[] = [];
    for (const [k, label] of Object.entries(REFLECTION_KEYS)) {
      const txt = v[k];
      if (typeof txt === "string" && txt.trim()) {
        topics.push({
          id: crypto.randomUUID(),
          title: label,
          content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: txt }] }] },
        });
      }
    }
    if (topics.length) return topics;
  }
  return [{ id: crypto.randomUUID(), title: "", content: null }];
}

export function TopicsEditor({ value, onChange, placeholder, legacyTitle, storageKey }: Props) {
  const [topics, setTopics] = useState<Topic[]>(() => normalize(value, legacyTitle));
  const [recoverable, setRecoverable] = useState<{ topics: Topic[]; savedAt: number } | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const draftKey = storageKey ? `topics-draft:${storageKey}` : null;

  // Detect recoverable draft on mount (only if newer than committed value).
  useEffect(() => {
    if (!draftKey || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { topics: Topic[]; savedAt: number };
      const committed = JSON.stringify(normalize(value, legacyTitle));
      if (JSON.stringify(parsed.topics) !== committed) {
        setRecoverable(parsed);
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commit = (next: Topic[]) => {
    setTopics(next);
    // Immediate local draft (recovery) write
    if (draftKey && typeof window !== "undefined") {
      try {
        const payload = { topics: next, savedAt: Date.now() };
        localStorage.setItem(draftKey, JSON.stringify(payload));
        setSavedAt(payload.savedAt);
      } catch { /* quota / private mode */ }
    }
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      onChange(next);
      if (draftKey && typeof window !== "undefined") {
        try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      }
    }, 600);
  };

  const update = (id: string, patch: Partial<Topic>) =>
    commit(topics.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const add = () =>
    setTopics((prev) => {
      const id = crypto.randomUUID();
      const next = [...prev, { id, title: "", content: null }];
      setOpenIds((s) => new Set(s).add(id));
      commit(next);
      return next;
    });

  const remove = (id: string) => {
    if (topics.length <= 1) {
      commit([{ id: crypto.randomUUID(), title: "", content: null }]);
      return;
    }
    commit(topics.filter((t) => t.id !== id));
  };

  const move = (id: string, dir: -1 | 1) => {
    const i = topics.findIndex((t) => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= topics.length) return;
    const next = [...topics];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  const memoTopics = useMemo(() => topics, [topics]);

  const toggle = (id: string) =>
    setOpenIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const expandAll = () => setOpenIds(new Set(memoTopics.map((t) => t.id)));
  const collapseAll = () => setOpenIds(new Set());

  return (
    <div className="space-y-6">
      {recoverable && (
        <div className="gold-frame rounded-md bg-accent/20 border border-gold/40 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
          <span>
            Há uma versão guardada localmente de{" "}
            <strong>{new Date(recoverable.savedAt).toLocaleString("pt-PT")}</strong> por gravar.
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              commit(recoverable.topics);
              setRecoverable(null);
              toast.success("Rascunho restaurado.");
            }}>Recuperar</Button>
            <Button size="sm" variant="ghost" onClick={() => {
              if (draftKey) try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
              setRecoverable(null);
            }}>Descartar</Button>
          </div>
        </div>
      )}

      <SortableList
        items={memoTopics}
        onReorder={(next) => commit(next)}
        renderItem={(t, dragHandle) => {
          const idx = memoTopics.findIndex((x) => x.id === t.id);
          const isOpen = openIds.has(t.id);
          const preview = previewOf(t.content);
          return (
            <div className="gold-frame rounded-md bg-card overflow-hidden">
              <div className="flex items-center gap-2 border-b bg-card/60 px-3 py-2">
                {dragHandle}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => toggle(t.id)}
                  title={isOpen ? "Colapsar" : "Expandir"}
                  aria-expanded={isOpen}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                <span className="font-display text-xs uppercase tracking-[0.18em] text-gold px-1">
                  §{idx + 1}
                </span>
                {isOpen ? (
                  <Input
                    value={t.title}
                    onChange={(e) => update(t.id, { title: e.target.value })}
                    placeholder="Título do tópico (opcional)"
                    className="border-0 bg-transparent font-display text-lg shadow-none focus-visible:ring-0 px-1"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(t.id)}
                    className="flex-1 min-w-0 text-left px-1 py-0.5 group"
                  >
                    <span className="font-display text-lg group-hover:text-burgundy block truncate">
                      {t.title?.trim() || <em className="text-muted-foreground">Sem título</em>}
                    </span>
                    {preview && (
                      <span className="block text-xs text-muted-foreground truncate">{preview}</span>
                    )}
                  </button>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => move(t.id, -1)} disabled={idx === 0} title="Subir prioridade">
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => move(t.id, 1)} disabled={idx === memoTopics.length - 1} title="Descer prioridade">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive" title="Remover">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {isOpen && (
                <TopicEditor
                  value={t.content}
                  placeholder={placeholder}
                  onChange={(c) => update(t.id, { content: c })}
                />
              )}
            </div>
          );
        }}
      />

      <div className="flex justify-center gap-2">
        <Button onClick={expandAll} variant="ghost" size="sm" disabled={openIds.size === memoTopics.length}>
          Expandir tudo
        </Button>
        <Button onClick={collapseAll} variant="ghost" size="sm" disabled={openIds.size === 0}>
          Colapsar tudo
        </Button>
        <Button onClick={add} variant="outline" className="gold-frame">
          <Plus className="h-4 w-4 mr-2" /> Adicionar tópico
        </Button>
      </div>
      {savedAt && (
        <p className="text-center text-xs text-muted-foreground">
          Rascunho local guardado às {new Date(savedAt).toLocaleTimeString("pt-PT")}
        </p>
      )}
    </div>
  );
}

function TopicEditor({ value, placeholder, onChange }: { value: unknown; placeholder?: string; onChange: (c: unknown) => void }) {
  return (
    <div className="border-0">
      <TiptapEditor value={value} onChange={onChange} placeholder={placeholder} minHeight="20vh" />
    </div>
  );
}

function previewOf(content: unknown, max = 140): string {
  const txt = extractText(content).replace(/\s+/g, " ").trim();
  return txt.length > max ? txt.slice(0, max) + "…" : txt;
}

function extractText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown };
  let out = "";
  if (typeof n.text === "string") out += n.text + " ";
  if (n.content) out += extractText(n.content);
  return out;
}