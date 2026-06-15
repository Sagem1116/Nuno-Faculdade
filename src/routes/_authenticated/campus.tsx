import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCourses, createCourse, deleteCourse, duplicateCourse, reorderCourses, updateCourse,
  listAllLessons,
} from "@/lib/db";
import { SortableList } from "@/components/sortable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useState, useMemo } from "react";
import { Plus, MoreHorizontal, BookOpen, Layers, GraduationCap, Clock, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/campus")({
  head: () => ({ meta: [{ title: "Campus — Universidade Digital" }] }),
  component: CampusPage,
});

function CampusPage() {
  const qc = useQueryClient();
  const { data: courses = [] } = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const { data: lessons = [] } = useQuery({ queryKey: ["all-lessons"], queryFn: listAllLessons });

  const stats = useMemo(() => {
    const completed = lessons.filter((l) => l.status === "completed" || l.status === "mastered").length;
    const total = lessons.length;
    const minutes = lessons.reduce((s, l) => s + (l.study_minutes ?? 0), 0);
    const overall = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { completed, total, hours: Math.round(minutes / 60), overall };
  }, [lessons]);

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderCourses(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl gold-frame paper p-8 sm:p-12 mb-10">
        <div className="absolute -top-10 -right-10 h-64 w-64 rounded-full bg-burgundy/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="ornate-divider text-xs uppercase tracking-[0.3em] mb-4 max-w-md text-gold">
            <span>O teu Campus</span>
          </p>
          <h1 className="font-display text-4xl sm:text-5xl text-foreground max-w-3xl">
            Hoje é um bom dia para aprender.
          </h1>
          <p className="font-serif italic text-muted-foreground mt-3 max-w-2xl">
            "A educação é a arma mais poderosa que podes usar para mudar o mundo."
          </p>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={<BookOpen className="h-4 w-4" />} label="Cursos" value={courses.length} />
            <Stat icon={<GraduationCap className="h-4 w-4" />} label="Aulas concluídas" value={`${stats.completed}/${stats.total || 0}`} />
            <Stat icon={<Clock className="h-4 w-4" />} label="Horas de estudo" value={stats.hours} />
            <Stat icon={<Sparkles className="h-4 w-4" />} label="Progresso geral" value={`${stats.overall}%`} />
          </div>
        </div>
      </section>

      {/* Header row */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl">Faculdades & Cursos</h2>
          <p className="text-sm text-muted-foreground">Arrasta para reordenar. Clica para entrar.</p>
        </div>
        <NewCourseDialog />
      </div>

      {courses.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="h-10 w-10 mx-auto text-accent mb-4" />
          <h3 className="font-display text-xl mb-1">O teu campus está vazio</h3>
          <p className="text-sm text-muted-foreground mb-6">Cria o teu primeiro curso para começar.</p>
          <NewCourseDialog />
        </Card>
      ) : (
        <SortableList
          items={courses}
          onReorder={(next) => {
            qc.setQueryData(["courses"], next);
            reorder.mutate(next.map((c) => c.id));
          }}
          renderItem={(course, handle) => (
            <CourseCard
              course={course}
              handle={handle}
              lessons={lessons.filter((l) => l.course_id === course.id)}
            />
          )}
        />
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border/70 bg-card/70 px-4 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="text-gold">{icon}</span>
        {label}
      </div>
      <div className="font-display text-2xl mt-1">{value}</div>
    </div>
  );
}

function CourseCard({ course, handle, lessons }:
  { course: import("@/lib/db").Course; handle: React.ReactNode; lessons: import("@/lib/db").Lesson[] }) {
  const qc = useQueryClient();
  const moduleIds = new Set(lessons.map((l) => l.module_id));
  const completed = lessons.filter((l) => l.status === "completed" || l.status === "mastered").length;
  const pct = lessons.length === 0 ? 0 : Math.round((completed / lessons.length) * 100);
  const [editOpen, setEditOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => deleteCourse(course.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["courses"] }); toast.success("Curso apagado."); },
  });
  const dup = useMutation({
    mutationFn: () => duplicateCourse(course.id),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Curso duplicado."); },
  });

  return (
    <Card className="p-5 flex gap-4 items-start gold-frame hover:shadow-lg transition-shadow">
      <div className="pt-1">{handle}</div>
      <div className="text-3xl pt-1" aria-hidden>{course.emoji ?? "📚"}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link to="/courses/$courseId" params={{ courseId: course.id }} className="font-display text-xl hover:text-burgundy">
              {course.name}
            </Link>
            {course.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{course.description}</p>}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={() => dup.mutate()}>Duplicar</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { if (confirm(`Apagar "${course.name}"?`)) del.mutate(); }} className="text-destructive">Apagar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-4">
          <div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-1.5">
              <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-gold" /> {moduleIds.size} módulos</span>
              <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5 text-gold" /> {lessons.length} aulas</span>
              <span className="font-medium text-foreground">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
          <Link to="/courses/$courseId" params={{ courseId: course.id }}>
            <Button variant="outline" size="sm">Abrir <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
          </Link>
        </div>
      </div>
      <EditCourseDialog course={course} open={editOpen} onOpenChange={setEditOpen} />
    </Card>
  );
}

function NewCourseDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("📚");
  const m = useMutation({
    mutationFn: () => createCourse({ name, description, emoji }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      setOpen(false); setName(""); setDescription(""); setEmoji("📚");
      toast.success("Curso criado.");
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4 mr-1" /> Novo curso</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl">Novo Curso</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div className="space-y-2">
              <Label>Emoji</Label>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} className="text-2xl text-center" />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Relações Internacionais" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Sobre o que é este curso?" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={m.isPending}>Criar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCourseDialog({ course, open, onOpenChange }:
  { course: import("@/lib/db").Course; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(course.name);
  const [description, setDescription] = useState(course.description ?? "");
  const [emoji, setEmoji] = useState(course.emoji ?? "📚");
  const m = useMutation({
    mutationFn: () => updateCourse(course.id, { name, description, emoji }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["courses"] }); onOpenChange(false); toast.success("Curso atualizado."); },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl">Editar curso</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div className="space-y-2"><Label>Emoji</Label><Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} className="text-2xl text-center" /></div>
            <div className="space-y-2"><Label>Nome</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
          <DialogFooter><Button type="submit" disabled={m.isPending}>Guardar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}