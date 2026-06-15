import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getCourse, listModules, createModule, deleteModule, updateModule, reorderModules,
  listLessonsByCourse, createLesson, deleteLesson, reorderLessons,
} from "@/lib/db";
import { summarizeCourseFn, summarizeModuleFn } from "@/lib/ai.functions";
import { SortableList } from "@/components/sortable";
import { SummaryCard } from "@/components/summary-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus, MoreHorizontal, ArrowLeft, BookOpen, Layers, Sparkles, Network } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const qc = useQueryClient();
  const { data: course } = useQuery({ queryKey: ["course", courseId], queryFn: () => getCourse(courseId) });
  const { data: modules = [] } = useQuery({ queryKey: ["modules", courseId], queryFn: () => listModules(courseId) });
  const { data: lessons = [] } = useQuery({ queryKey: ["lessons-by-course", courseId], queryFn: () => listLessonsByCourse(courseId) });

  const reorderMods = useMutation({
    mutationFn: (ids: string[]) => reorderModules(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modules", courseId] }),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <Link to="/campus" className="inline-flex items-center text-sm text-muted-foreground hover:text-burgundy mb-4"><ArrowLeft className="h-4 w-4 mr-1" /> Campus</Link>
      <header className="mb-8 paper rounded-xl gold-frame p-8">
        <p className="ornate-divider text-[10px] uppercase tracking-[0.3em] mb-3 text-gold"><span>Programa do Curso</span></p>
        <div className="flex items-start gap-4">
          <div className="text-5xl">{course?.emoji ?? "📚"}</div>
          <div>
            <h1 className="font-display text-4xl">{course?.name ?? "—"}</h1>
            {course?.description && <p className="text-muted-foreground mt-2 font-serif">{course.description}</p>}
            <div className="flex gap-5 text-xs text-muted-foreground mt-4">
              <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-gold" /> {modules.length} módulos</span>
              <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5 text-gold" /> {lessons.length} aulas</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl">Módulos</h2>
        <div className="flex gap-2">
          <Link to="/assistant" search={{ courseId }} className="inline-flex items-center gap-1 text-sm text-burgundy hover:underline px-3"><Sparkles className="h-3.5 w-3.5 text-gold" /> Assistente deste curso</Link>
          <Link to="/concept-map/$courseId" params={{ courseId }} className="inline-flex items-center gap-1 text-sm text-burgundy hover:underline px-3"><Network className="h-3.5 w-3.5 text-gold" /> Mapa de Conceitos</Link>
          <NewModuleForm courseId={courseId} />
        </div>
      </div>

      <div className="mb-6">
        <CourseSummary courseId={courseId} summary={course?.summary as Record<string, unknown> | null | undefined} />
      </div>

      {modules.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Cria o primeiro módulo para organizar as aulas.</Card>
      ) : (
        <SortableList
          items={modules}
          onReorder={(next) => { qc.setQueryData(["modules", courseId], next); reorderMods.mutate(next.map((m) => m.id)); }}
          renderItem={(mod, handle) => (
            <ModuleRow
              module={mod}
              handle={handle}
              lessons={lessons.filter((l) => l.module_id === mod.id)}
              courseId={courseId}
            />
          )}
        />
      )}
    </div>
  );
}

function CourseSummary({ courseId, summary }: { courseId: string; summary: Record<string, unknown> | null | undefined }) {
  const qc = useQueryClient();
  const fn = useServerFn(summarizeCourseFn);
  const m = useMutation({
    mutationFn: () => fn({ data: { courseId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["course", courseId] }); toast.success("Apanhado gerado."); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <SummaryCard title="Gerar Apanhado Geral do Curso" summary={summary ?? null} onGenerate={() => m.mutate()} loading={m.isPending} />;
}

function ModuleSummary({ moduleId, summary }: { moduleId: string; summary: Record<string, unknown> | null | undefined }) {
  const qc = useQueryClient();
  const fn = useServerFn(summarizeModuleFn);
  const m = useMutation({
    mutationFn: () => fn({ data: { moduleId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["modules"] }); toast.success("Resumo do módulo gerado."); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mb-3">
      <SummaryCard title="Gerar Resumo do Módulo" summary={summary ?? null} onGenerate={() => m.mutate()} loading={m.isPending} />
    </div>
  );
}

function NewModuleForm({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const m = useMutation({
    mutationFn: () => createModule(courseId, title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modules", courseId] });
      setTitle(""); setOpen(false); toast.success("Módulo criado.");
    },
  });
  if (!open) return <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo módulo</Button>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) m.mutate(); }} className="flex gap-2">
      <Input autoFocus placeholder="Nome do módulo" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Button type="submit" disabled={!title.trim()}>Criar</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
    </form>
  );
}

function ModuleRow({ module, handle, lessons, courseId }:
  { module: import("@/lib/db").Module; handle: React.ReactNode; lessons: import("@/lib/db").Lesson[]; courseId: string }) {
  const qc = useQueryClient();
  const [openExpand, setOpenExpand] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(module.title);

  const del = useMutation({
    mutationFn: () => deleteModule(module.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["modules", courseId] }); qc.invalidateQueries({ queryKey: ["lessons-by-course", courseId] }); toast.success("Módulo apagado."); },
  });
  const save = useMutation({
    mutationFn: () => updateModule(module.id, { title }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["modules", courseId] }); setEditing(false); },
  });
  const reorderLes = useMutation({
    mutationFn: (ids: string[]) => reorderLessons(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessons-by-course", courseId] }),
  });

  return (
    <Card className="overflow-hidden">
      <Collapsible open={openExpand} onOpenChange={setOpenExpand}>
        <div className="flex items-center gap-2 p-3">
          {handle}
          <CollapsibleTrigger className="p-1 rounded hover:bg-accent/30">
            <ChevronDown className={cn("h-4 w-4 transition-transform", !openExpand && "-rotate-90")} />
          </CollapsibleTrigger>
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="flex-1 flex gap-2">
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
              <Button size="sm" type="submit">Guardar</Button>
            </form>
          ) : (
            <h3 className="font-display text-lg flex-1">{module.title}</h3>
          )}
          <span className="text-xs text-muted-foreground">{lessons.length} aulas</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(true)}>Renomear</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { if (confirm("Apagar módulo e todas as aulas?")) del.mutate(); }} className="text-destructive">Apagar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CollapsibleContent className="border-t bg-secondary/30 px-3 py-3">
          <ModuleSummary moduleId={module.id} summary={module.summary as Record<string, unknown> | null | undefined} />
          {lessons.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">Sem aulas. Cria a primeira abaixo.</p>
          )}
          {lessons.length > 0 && (
            <SortableList
              items={lessons}
              onReorder={(next) => { qc.setQueryData(["lessons-by-course", courseId], (prev: import("@/lib/db").Lesson[] = []) => {
                const others = prev.filter((l) => l.module_id !== module.id);
                return [...others, ...next];
              }); reorderLes.mutate(next.map((l) => l.id)); }}
              renderItem={(lesson, lhandle) => (
                <LessonRow lesson={lesson} handle={lhandle} courseId={courseId} moduleId={module.id} />
              )}
            />
          )}
          <NewLessonForm moduleId={module.id} courseId={courseId} />
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

const statusLabel: Record<string, string> = {
  not_started: "Não iniciada",
  in_progress: "Em estudo",
  completed: "Concluída",
  mastered: "Dominada",
};
const statusDot: Record<string, string> = {
  not_started: "bg-muted-foreground/40",
  in_progress: "bg-accent",
  completed: "bg-emerald-600",
  mastered: "bg-burgundy",
};

function LessonRow({ lesson, handle, courseId, moduleId }:
  { lesson: import("@/lib/db").Lesson; handle: React.ReactNode; courseId: string; moduleId: string }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => deleteLesson(lesson.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessons-by-course", courseId] }),
  });
  return (
    <div className="flex items-center gap-2 p-2 rounded hover:bg-card/70 group">
      {handle}
      <span className={cn("h-2 w-2 rounded-full shrink-0", statusDot[lesson.status])} />
      <Link to="/lessons/$lessonId" params={{ lessonId: lesson.id }} className="flex-1 font-serif hover:text-burgundy truncate">
        {lesson.title}
      </Link>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{statusLabel[lesson.status]}</span>
      <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => { if (confirm("Apagar aula?")) del.mutate(); }}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}

function NewLessonForm({ moduleId, courseId }: { moduleId: string; courseId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const m = useMutation({
    mutationFn: () => createLesson(moduleId, courseId, title),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lessons-by-course", courseId] }); setTitle(""); },
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) m.mutate(); }} className="mt-2 flex gap-2">
      <Input placeholder="Nova aula…" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-card" />
      <Button type="submit" variant="outline" disabled={!title.trim()}><Plus className="h-4 w-4 mr-1" /> Aula</Button>
    </form>
  );
}