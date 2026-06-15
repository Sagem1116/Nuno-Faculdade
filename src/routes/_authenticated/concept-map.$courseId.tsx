import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateConceptMapFn, getConceptMapFn } from "@/lib/ai.functions";
import { getCourse } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Network, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/concept-map/$courseId")({
  component: ConceptMapPage,
});

type LessonRef = { lesson_id: string; title: string };
type Related = { label: string; descricao?: string; aulas?: LessonRef[] };
type SubConcept = { label: string; descricao?: string; relacionados?: Related[] };
type MapData = { central?: string; subconceitos?: SubConcept[] };

function ConceptMapPage() {
  const { courseId } = Route.useParams();
  const { data: course } = useQuery({ queryKey: ["course", courseId], queryFn: () => getCourse(courseId) });
  const getFn = useServerFn(getConceptMapFn);
  const stored = useQuery({
    queryKey: ["concept-map", courseId],
    queryFn: () => getFn({ data: { courseId } }),
  });

  const genFn = useServerFn(generateConceptMapFn);
  const [central, setCentral] = useState("");
  const [data, setData] = useState<MapData | null>(null);

  useEffect(() => {
    const d = (stored.data as { data?: MapData } | null)?.data;
    if (d) setData(d);
  }, [stored.data]);

  const generate = useMutation({
    mutationFn: () => genFn({ data: { courseId, central: central || undefined } }),
    onSuccess: (json) => { setData(json as MapData); toast.success("Mapa gerado."); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <Link to="/courses/$courseId" params={{ courseId }} className="inline-flex items-center text-sm text-muted-foreground hover:text-burgundy mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> {course?.name ?? "Curso"}
      </Link>

      <header className="paper gold-frame rounded-xl p-6 mb-6">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground inline-flex items-center gap-2"><Network className="h-3.5 w-3.5 text-gold" /> Mapa de Conceitos</p>
        <h1 className="font-display text-3xl mt-1">{course?.name ?? "—"}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Input
            value={central}
            onChange={(e) => setCentral(e.target.value)}
            placeholder={`Conceito central (por omissão: ${course?.name ?? "curso"})`}
            className="max-w-md"
          />
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            <Sparkles className="h-4 w-4 mr-2" />
            {generate.isPending ? "A pensar…" : data ? "Regenerar" : "Gerar mapa"}
          </Button>
        </div>
      </header>

      {data?.subconceitos?.length ? (
        <ConceptGraph data={data} />
      ) : (
        <Card className="p-10 text-center text-muted-foreground">
          {stored.isLoading ? "A carregar…" : "Ainda não foi gerado um mapa. Carrega em \"Gerar mapa\" para criar a partir da tua matéria."}
        </Card>
      )}
    </div>
  );
}

// ─── Visualisation ──────────────────────────────────────────────────

function ConceptGraph({ data }: { data: MapData }) {
  const navigate = useNavigate();
  const subs = data.subconceitos ?? [];
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(subs.map((_, i) => i)));
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const layout = useMemo(() => buildLayout(data, expanded), [data, expanded]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setView((v) => ({ ...v, k: Math.min(2.5, Math.max(0.4, v.k * (1 + delta))) }));
  };
  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const d = dragRef.current; if (!d) return;
    setView((v) => ({ ...v, x: d.vx + (e.clientX - d.x), y: d.vy + (e.clientY - d.y) }));
  };
  const onMouseUp = () => { dragRef.current = null; };

  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
        <Button size="icon" variant="secondary" onClick={() => setView((v) => ({ ...v, k: Math.min(2.5, v.k * 1.2) }))}><ZoomIn className="h-4 w-4" /></Button>
        <Button size="icon" variant="secondary" onClick={() => setView((v) => ({ ...v, k: Math.max(0.4, v.k / 1.2) }))}><ZoomOut className="h-4 w-4" /></Button>
        <Button size="icon" variant="secondary" onClick={() => setView({ x: 0, y: 0, k: 1 })}><Maximize2 className="h-4 w-4" /></Button>
      </div>
      <Card className="overflow-hidden bg-[oklch(0.97_0.02_85)] dark:bg-[oklch(0.18_0.02_70)]">
        <svg
          ref={svgRef}
          viewBox="-500 -400 1000 800"
          className="w-full h-[72vh] cursor-grab active:cursor-grabbing select-none"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <defs>
            <radialGradient id="centralGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="oklch(0.45 0.12 30)" />
              <stop offset="100%" stopColor="oklch(0.30 0.08 30)" />
            </radialGradient>
            <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {/* Edges */}
            {layout.edges.map((e, i) => (
              <path key={i} d={curve(e.x1, e.y1, e.x2, e.y2)} stroke={e.kind === "lesson" ? "oklch(0.65 0.12 80)" : "oklch(0.55 0.08 40)"} strokeWidth={e.kind === "lesson" ? 1 : 1.6} fill="none" strokeOpacity={0.55} />
            ))}

            {/* Central */}
            <g>
              <circle r={66} fill="url(#centralGrad)" filter="url(#soft)" />
              <text textAnchor="middle" dy="0.35em" fill="white" className="font-display" fontSize={16}>
                {wrap(layout.central, 14).map((line, i, arr) => (
                  <tspan key={i} x={0} dy={i === 0 ? -((arr.length - 1) * 8) : 16}>{line}</tspan>
                ))}
              </text>
            </g>

            {/* Subconcepts */}
            {layout.subs.map((s, i) => (
              <g key={i} transform={`translate(${s.x} ${s.y})`} onClick={() => setExpanded((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })} className="cursor-pointer">
                <circle r={42} fill="oklch(0.93 0.04 85)" stroke="oklch(0.55 0.10 40)" strokeWidth={2} />
                <text textAnchor="middle" dy="0.35em" fill="oklch(0.30 0.08 40)" className="font-display" fontSize={11}>
                  {wrap(s.label, 12).map((line, li, arr) => (
                    <tspan key={li} x={0} dy={li === 0 ? -((arr.length - 1) * 6) : 12}>{line}</tspan>
                  ))}
                </text>
              </g>
            ))}

            {/* Related themes */}
            {layout.themes.map((t, i) => (
              <g key={i} transform={`translate(${t.x} ${t.y})`}>
                <rect x={-58} y={-16} width={116} height={32} rx={16} fill="oklch(0.97 0.02 90)" stroke="oklch(0.65 0.12 80)" />
                <text textAnchor="middle" dy="0.35em" fontSize={10} fill="oklch(0.30 0.05 60)" className="font-serif">
                  {ellipsize(t.label, 22)}
                </text>
              </g>
            ))}

            {/* Lessons */}
            {layout.lessons.map((l, i) => (
              <g key={i} transform={`translate(${l.x} ${l.y})`} className="cursor-pointer" onClick={() => navigate({ to: "/lessons/$lessonId", params: { lessonId: l.lesson_id } })}>
                <circle r={5} fill="oklch(0.65 0.14 80)" />
                <text x={l.x > 0 ? 9 : -9} dy="0.35em" textAnchor={l.x > 0 ? "start" : "end"} fontSize={9} fill="oklch(0.35 0.04 60)">
                  {ellipsize(l.title, 28)}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </Card>
      <p className="text-xs text-muted-foreground mt-2 text-center">Arrasta para mover · roda para fazer zoom · clica num subconceito para expandir/colapsar · clica numa aula para abrir.</p>
    </div>
  );
}

type Node = { x: number; y: number; label: string };
type LessonNode = Node & { lesson_id: string; title: string };
type Edge = { x1: number; y1: number; x2: number; y2: number; kind: "sub" | "theme" | "lesson" };

function buildLayout(data: MapData, expanded: Set<number>) {
  const subs = data.subconceitos ?? [];
  const R1 = 200; // subconcepts ring
  const R2 = 340; // themes ring
  const R3 = 460; // lessons ring
  const subNodes: Node[] = [];
  const themeNodes: Node[] = [];
  const lessonNodes: LessonNode[] = [];
  const edges: Edge[] = [];

  const n = Math.max(subs.length, 1);
  subs.forEach((s, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const sx = Math.cos(a) * R1, sy = Math.sin(a) * R1;
    subNodes.push({ x: sx, y: sy, label: s.label });
    edges.push({ x1: 0, y1: 0, x2: sx, y2: sy, kind: "sub" });

    if (!expanded.has(i)) return;
    const related = s.relacionados ?? [];
    const span = (Math.PI * 2) / n; // each sub gets this slice
    related.forEach((r, j) => {
      const ta = a + (j - (related.length - 1) / 2) * (span / Math.max(related.length, 1)) * 0.6;
      const tx = Math.cos(ta) * R2, ty = Math.sin(ta) * R2;
      themeNodes.push({ x: tx, y: ty, label: r.label });
      edges.push({ x1: sx, y1: sy, x2: tx, y2: ty, kind: "theme" });

      const aulas = r.aulas ?? [];
      aulas.forEach((les, k) => {
        const la = ta + (k - (aulas.length - 1) / 2) * 0.08;
        const lx = Math.cos(la) * R3, ly = Math.sin(la) * R3;
        lessonNodes.push({ x: lx, y: ly, lesson_id: les.lesson_id, title: les.title, label: les.title });
        edges.push({ x1: tx, y1: ty, x2: lx, y2: ly, kind: "lesson" });
      });
    });
  });

  return { central: data.central || "Curso", subs: subNodes, themes: themeNodes, lessons: lessonNodes, edges };
}

function curve(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

function wrap(s: string, max: number): string[] {
  const words = s.split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { if (cur) out.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out.slice(0, 3);
}

function ellipsize(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}