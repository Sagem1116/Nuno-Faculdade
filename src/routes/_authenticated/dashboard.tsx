import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listCourses, listAllLessons } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, Clock, BookOpen, Layers, Flame, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Universidade Digital" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: courses = [] } = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const { data: lessons = [] } = useQuery({ queryKey: ["all-lessons"], queryFn: listAllLessons });

  const stats = useMemo(() => {
    const completed = lessons.filter((l) => l.status === "completed" || l.status === "mastered");
    const minutes = lessons.reduce((s, l) => s + (l.study_minutes ?? 0), 0);
    return {
      completed: completed.length, total: lessons.length,
      hours: Math.round(minutes / 60), minutes,
    };
  }, [lessons]);

  // Calendar - last 84 days activity heat
  const days = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lessons) {
      if (!l.completed_at) continue;
      const d = new Date(l.completed_at).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    const arr: { date: string; count: number }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      arr.push({ date: key, count: map.get(key) ?? 0 });
    }
    return arr;
  }, [lessons]);

  const streak = useMemo(() => {
    const set = new Set(days.filter((d) => d.count > 0).map((d) => d.date));
    let s = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (set.has(d.toISOString().slice(0, 10))) s++;
      else if (i > 0) break;
    }
    return s;
  }, [days]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-8">
      <header>
        <p className="ornate-divider text-xs uppercase tracking-[0.3em] mb-3 text-gold max-w-sm"><span>Registos Académicos</span></p>
        <h1 className="font-display text-4xl">Dashboard Académico</h1>
        <p className="text-muted-foreground">Visão geral do teu progresso.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BigStat icon={<BookOpen />} label="Cursos" value={courses.length} />
        <BigStat icon={<Layers />} label="Aulas no total" value={stats.total} />
        <BigStat icon={<CheckCircle2 />} label="Concluídas" value={stats.completed} />
        <BigStat icon={<Clock />} label="Horas de estudo" value={stats.hours} />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">Progresso por curso</h2>
          <span className="text-xs text-muted-foreground">{stats.total} aulas no total</span>
        </div>
        {courses.length === 0 && <p className="text-sm text-muted-foreground">Ainda não há cursos.</p>}
        <div className="space-y-4">
          {courses.map((c) => {
            const cl = lessons.filter((l) => l.course_id === c.id);
            const done = cl.filter((l) => l.status === "completed" || l.status === "mastered").length;
            const pct = cl.length === 0 ? 0 : Math.round((done / cl.length) * 100);
            return (
              <div key={c.id}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <Link to="/courses/$courseId" params={{ courseId: c.id }} className="hover:text-burgundy font-serif">
                    <span className="mr-2">{c.emoji}</span>{c.name}
                  </Link>
                  <span className="text-muted-foreground">{done}/{cl.length} · {pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl">Calendário de atividade</h2>
            <span className="text-xs text-muted-foreground">Últimos 84 dias</span>
          </div>
          <div className="grid grid-cols-[repeat(12,1fr)] gap-1.5">
            {days.map((d) => (
              <div key={d.date}
                title={`${d.date}: ${d.count} aula(s) concluída(s)`}
                className="aspect-square rounded-sm"
                style={{
                  background: d.count === 0
                    ? "color-mix(in oklab, var(--color-border) 70%, transparent)"
                    : `color-mix(in oklab, var(--color-gold) ${Math.min(100, 25 + d.count * 25)}%, var(--color-card))`,
                }} />
            ))}
          </div>
        </Card>

        <Card className="p-6 text-center">
          <Flame className="h-12 w-12 mx-auto text-burgundy" />
          <div className="font-display text-5xl mt-2">{streak}</div>
          <p className="text-sm text-muted-foreground mt-1">dia{streak === 1 ? "" : "s"} de estudo seguidos</p>
          <p className="font-serif italic text-xs text-muted-foreground mt-4">"Pequenos passos diários constroem grandes intelectos."</p>
        </Card>
      </div>

      <Card className="p-6 text-center bg-secondary/30">
        <GraduationCap className="h-8 w-8 mx-auto text-gold mb-2" />
        <p className="font-serif italic text-muted-foreground">
          Em breve: centro de revisão espaçada, mapa de conhecimento, exercícios e recursos.
        </p>
      </Card>
    </div>
  );
}

function BigStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="text-gold [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {label}
      </div>
      <div className="font-display text-4xl mt-2">{value}</div>
    </Card>
  );
}