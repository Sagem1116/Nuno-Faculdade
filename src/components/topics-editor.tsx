import { useEffect, useMemo, useRef, useState } from "react";
import { TiptapEditor } from "./tiptap-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

export type Topic = { id: string; title: string; content: unknown };

type Props = {
  value: unknown;
  onChange: (topics: Topic[]) => void;
  placeholder?: string;
  /** Used to label the first auto-migrated topic from legacy data. */
  legacyTitle?: string;
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

export function TopicsEditor({ value, onChange, placeholder, legacyTitle }: Props) {
  const [topics, setTopics] = useState<Topic[]>(() => normalize(value, legacyTitle));
  const initialized = useRef(true);

  // If parent value changes externally (and isn't our own array), reseed.
  useEffect(() => {
    if (!Array.isArray(value)) {
      const next = normalize(value, legacyTitle);
      setTopics(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commit = (next: Topic[]) => {
    setTopics(next);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => onChange(next), 400);
  };

  const update = (id: string, patch: Partial<Topic>) =>
    commit(topics.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const add = () =>
    commit([...topics, { id: crypto.randomUUID(), title: "", content: null }]);

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

  return (
    <div className="space-y-6">
      {memoTopics.map((t, idx) => (
        <div key={t.id} className="gold-frame rounded-md bg-card overflow-hidden">
          <div className="flex items-center gap-2 border-b bg-card/60 px-3 py-2">
            <span className="font-display text-xs uppercase tracking-[0.18em] text-gold px-1">
              §{idx + 1}
            </span>
            <Input
              value={t.title}
              onChange={(e) => update(t.id, { title: e.target.value })}
              placeholder="Título do tópico (opcional)"
              className="border-0 bg-transparent font-display text-lg shadow-none focus-visible:ring-0 px-1"
            />
            <div className="ml-auto flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => move(t.id, -1)} disabled={idx === 0} title="Subir">
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => move(t.id, 1)} disabled={idx === topics.length - 1} title="Descer">
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive" title="Remover">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <TopicEditor
            value={t.content}
            placeholder={placeholder}
            onChange={(c) => update(t.id, { content: c })}
          />
        </div>
      ))}
      <div className="flex justify-center">
        <Button onClick={add} variant="outline" className="gold-frame">
          <Plus className="h-4 w-4 mr-2" /> Adicionar tópico
        </Button>
      </div>
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