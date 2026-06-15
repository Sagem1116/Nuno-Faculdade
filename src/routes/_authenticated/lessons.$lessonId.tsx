import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLesson, getCourse, listModules, updateLesson, type Lesson, type LessonStatus, type NoteItem } from "@/lib/db";
import { summarizeLessonFn } from "@/lib/ai.functions";
import { TiptapEditor } from "@/components/tiptap-editor";
import { DocumentsTab } from "@/components/documents-tab";
import { SummaryCard } from "@/components/summary-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, BookOpen, NotebookPen, MessageSquareQuote, Plus, X, StickyNote, Highlighter, FolderOpen, Sparkles, ClipboardCheck, Scale, PenLine } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lessons/$lessonId")({
  component: LessonPage,
});

const STATUSES: { value: LessonStatus; label: string }[] = [
  { value: "not_started", label: "Não iniciada" },
  { value: "in_progress", label: "Em estudo" },
  { value: "completed", label: "Concluída" },
  { value: "mastered", label: "Dominada" },
];

function LessonPage() {
  const { lessonId } = Route.useParams();
  const qc = useQueryClient();
  const { data: lesson, isLoading } = useQuery({ queryKey: ["lesson", lessonId], queryFn: () => getLesson(lessonId) });
  const { data: course } = useQuery({
    queryKey: ["course", lesson?.course_id], enabled: !!lesson?.course_id,
    queryFn: () => getCourse(lesson!.course_id),
  });
  const { data: modules = [] } = useQuery({
    queryKey: ["modules", lesson?.course_id], enabled: !!lesson?.course_id,
    queryFn: () => listModules(lesson!.course_id),
  });
  const moduleTitle = modules.find((m) => m.id === lesson?.module_id)?.title ?? "";

  const update = useMutation({
    mutationFn: (patch: Partial<Lesson>) => updateLesson(lessonId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lesson", lessonId] }),
  });

  if (isLoading || !lesson) {
    return <div className="p-12 text-center text-muted-foreground font-display">A carregar aula…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <Link to="/courses/$courseId" params={{ courseId: lesson.course_id }} className="inline-flex items-center text-sm text-muted-foreground hover:text-burgundy mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> {course?.name ?? "Curso"}
      </Link>

      <header className="paper gold-frame rounded-xl p-6 mb-6">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {course?.name} · <span className="text-gold">{moduleTitle}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <InlineEditableTitle
            value={lesson.title}
            onSave={(title) => update.mutate({ title })}
          />
          <div className="ml-auto flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select value={lesson.status} onValueChange={(v) => update.mutate({ status: v as LessonStatus, completed_at: (v === "completed" || v === "mastered") ? new Date().toISOString() : null })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <Tabs defaultValue="content" className="space-y-4">
        <TabsList className="bg-secondary/60">
          <TabsTrigger value="content"><BookOpen className="h-4 w-4 mr-2" /> Matéria</TabsTrigger>
          <TabsTrigger value="notes"><NotebookPen className="h-4 w-4 mr-2" /> Notas</TabsTrigger>
          <TabsTrigger value="reflection"><MessageSquareQuote className="h-4 w-4 mr-2" /> Reflexão Final</TabsTrigger>
          <TabsTrigger value="test"><ClipboardCheck className="h-4 w-4 mr-2" /> Teste</TabsTrigger>
          <TabsTrigger value="case"><Scale className="h-4 w-4 mr-2" /> Estudo de Caso</TabsTrigger>
          <TabsTrigger value="essay"><PenLine className="h-4 w-4 mr-2" /> Mini-Ensaio</TabsTrigger>
          <TabsTrigger value="documents"><FolderOpen className="h-4 w-4 mr-2" /> Documentos</TabsTrigger>
          <TabsTrigger value="summary"><Sparkles className="h-4 w-4 mr-2" /> Resumo IA</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          <ContentTab lesson={lesson} onChange={(content) => update.mutate({ content })} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab lesson={lesson} onChange={(notes) => update.mutate({ notes })} />
        </TabsContent>
        <TabsContent value="reflection">
          <ReflectionTab lesson={lesson} onChange={(reflection) => update.mutate({ reflection })} />
        </TabsContent>
        <TabsContent value="test">
          <RichTextTab
            value={lesson.test}
            placeholder="Escreve o teu teste de estudo para esta aula… (perguntas, exercícios, autoavaliação)"
            onChange={(test) => update.mutate({ test } as Partial<Lesson>)}
          />
        </TabsContent>
        <TabsContent value="case">
          <RichTextTab
            value={lesson.case_study}
            placeholder="Descreve um estudo de caso real onde aplicas os conceitos desta aula…"
            onChange={(case_study) => update.mutate({ case_study } as Partial<Lesson>)}
          />
        </TabsContent>
        <TabsContent value="essay">
          <RichTextTab
            value={lesson.essay}
            placeholder="Escreve um mini-ensaio sobre o tema desta aula…"
            onChange={(essay) => update.mutate({ essay } as Partial<Lesson>)}
          />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab lessonId={lesson.id} courseId={lesson.course_id} />
        </TabsContent>
        <TabsContent value="summary">
          <LessonSummaryTab lessonId={lesson.id} summary={lesson.summary as Record<string, unknown> | null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LessonSummaryTab({ lessonId, summary }: { lessonId: string; summary: Record<string, unknown> | null }) {
  const qc = useQueryClient();
  const fn = useServerFn(summarizeLessonFn);
  const m = useMutation({
    mutationFn: () => fn({ data: { lessonId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lesson", lessonId] }); toast.success("Resumo gerado."); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <SummaryCard title="Gerar Resumo da Aula" summary={summary} onGenerate={() => m.mutate()} loading={m.isPending} />;
}

function InlineEditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (editing) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); onSave(v.trim() || value); setEditing(false); }}>
        <Input autoFocus className="text-3xl font-display h-12" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { onSave(v.trim() || value); setEditing(false); }} />
      </form>
    );
  }
  return (
    <h1 className="font-display text-3xl cursor-text hover:text-burgundy" onClick={() => setEditing(true)}>{value}</h1>
  );
}

function ContentTab({ lesson, onChange }: { lesson: Lesson; onChange: (json: unknown) => void }) {
  // Debounce content saves
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <TiptapEditor
      value={lesson.content}
      onChange={(json) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => onChange(json), 600);
      }}
      placeholder="Começa a escrever as tuas notas de aula…"
    />
  );
}

function RichTextTab({ value, placeholder, onChange }: { value: unknown; placeholder: string; onChange: (json: unknown) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <TiptapEditor
      value={value}
      onChange={(json) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => onChange(json), 600);
      }}
      placeholder={placeholder}
    />
  );
}

function NotesTab({ lesson, onChange }: { lesson: Lesson; onChange: (notes: NoteItem[]) => void }) {
  const notes = lesson.notes ?? [];
  const [text, setText] = useState("");
  const [kind, setKind] = useState<NoteItem["kind"]>("note");
  const [category, setCategory] = useState("");

  const add = () => {
    if (!text.trim()) return;
    const next: NoteItem[] = [...notes, {
      id: crypto.randomUUID(), text, kind, category: category || undefined,
      created_at: new Date().toISOString(),
    }];
    onChange(next); setText("");
  };
  const remove = (id: string) => onChange(notes.filter((n) => n.id !== id));

  const categories = useMemo(() => Array.from(new Set(notes.map((n) => n.category).filter(Boolean))) as string[], [notes]);

  const KindIcon = kind === "postit" ? StickyNote : kind === "highlight" ? Highlighter : NotebookPen;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-3">
        {notes.length === 0 && <Card className="p-10 text-center text-muted-foreground">Sem notas ainda.</Card>}
        <div className="grid sm:grid-cols-2 gap-3">
          {notes.map((n) => (
            <div key={n.id} className={cn(
              "relative rounded-md p-4 text-sm shadow-sm group",
              n.kind === "postit" && "bg-yellow-100 text-yellow-950 rotate-[-0.5deg] font-serif",
              n.kind === "highlight" && "bg-accent/20 border-l-4 border-accent",
              n.kind === "note" && "bg-card border border-border",
            )}>
              <button onClick={() => remove(n.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
              {n.category && <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1">{n.category}</div>}
              <p className="whitespace-pre-wrap">{n.text}</p>
            </div>
          ))}
        </div>
      </div>
      <Card className="p-4 h-fit sticky top-24">
        <h3 className="font-display text-lg mb-3 flex items-center gap-2"><KindIcon className="h-4 w-4 text-gold" /> Nova nota</h3>
        <div className="space-y-3">
          <Select value={kind} onValueChange={(v) => setKind(v as NoteItem["kind"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="note">Nota</SelectItem>
              <SelectItem value="postit">Post-it</SelectItem>
              <SelectItem value="highlight">Destaque</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Categoria (opcional)" value={category} onChange={(e) => setCategory(e.target.value)} list="categories" />
          <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <Textarea rows={5} placeholder="Escreve uma ideia rápida…" value={text} onChange={(e) => setText(e.target.value)} />
          <Button onClick={add} className="w-full" disabled={!text.trim()}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </div>
      </Card>
    </div>
  );
}

function ReflectionTab({ lesson, onChange }: { lesson: Lesson; onChange: (r: import("@/lib/db").ReflectionData) => void }) {
  const r = lesson.reflection ?? {};
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const set = (patch: Partial<typeof r>) => {
    const next = { ...r, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), 500);
  };
  const fields: { key: keyof typeof r; label: string }[] = [
    { key: "learned", label: "O que aprendi hoje?" },
    { key: "not_understood", label: "O que ainda não compreendi?" },
    { key: "to_review", label: "O que devo rever?" },
    { key: "connections", label: "Como esta aula se relaciona com conteúdos anteriores?" },
    { key: "ideas", label: "Ideias e pensamentos pessoais" },
  ];
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {fields.map((f) => (
        <Card key={String(f.key)} className="p-5">
          <Label className="font-display text-base">{f.label}</Label>
          <Textarea
            rows={5}
            defaultValue={(r[f.key] as string) ?? ""}
            onChange={(e) => set({ [f.key]: e.target.value })}
            className="mt-2 font-serif"
            placeholder="Escreve a tua reflexão…"
          />
        </Card>
      ))}
    </div>
  );
}