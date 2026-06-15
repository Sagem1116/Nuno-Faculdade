import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { askAssistantFn, globalSearchFn } from "@/lib/ai.functions";
import { listCourses } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Send, Search, GraduationCap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { z } from "zod";
import { toast } from "sonner";

const search = z.object({ courseId: z.string().optional(), q: z.string().optional() });

export const Route = createFileRoute("/_authenticated/assistant")({
  validateSearch: (s) => search.parse(s),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function AssistantPage() {
  const s = useSearch({ from: Route.id });
  const [courseId, setCourseId] = useState<string>(s.courseId ?? "all");
  const { data: courses = [] } = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const ask = useServerFn(askAssistantFn);
  const send = useMutation({
    mutationFn: (question: string) => ask({ data: {
      question, history: messages, courseId: courseId === "all" ? null : courseId,
    } }),
    onSuccess: (r) => setMessages((m) => [...m, { role: "assistant", content: r.answer }]),
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || send.isPending) return;
    const q = input.trim();
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    send.mutate(q);
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, send.isPending]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 grid lg:grid-cols-[1fr_320px] gap-6">
      <div>
        <header className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold">Inteligência Académica</p>
          <h1 className="font-display text-4xl">Assistente Académico</h1>
          <p className="text-muted-foreground font-serif">Responde com base apenas nos teus apontamentos, matéria, notas, reflexões e documentos.</p>
        </header>

        <Card className="p-3 mb-3 flex items-center gap-3">
          <GraduationCap className="h-4 w-4 text-gold" />
          <span className="text-sm text-muted-foreground">Âmbito</span>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda a universidade</SelectItem>
              {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>

        <div className="space-y-4 min-h-[40vh]">
          {messages.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground font-serif">
              <Sparkles className="h-6 w-6 mx-auto text-gold mb-2" />
              Pergunta algo como "Resume todas as aulas onde aparece Realismo" ou "Cria um teste com base no Módulo 3".
            </Card>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "" : ""}>
              {m.role === "user" ? (
                <Card className="p-4 bg-primary text-primary-foreground ml-auto max-w-[80%] w-fit">{m.content}</Card>
              ) : (
                <div className="font-serif prose prose-sm max-w-none">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
          {send.isPending && <p className="text-muted-foreground text-sm italic">A pensar…</p>}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={onSubmit} className="sticky bottom-4 mt-6">
          <Card className="p-3 flex gap-2 items-end gold-frame">
            <Textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Faz uma pergunta…" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(e); } }}
            />
            <Button type="submit" disabled={!input.trim() || send.isPending}><Send className="h-4 w-4" /></Button>
          </Card>
        </form>
      </div>

      <aside className="space-y-4">
        <GlobalSearchPanel initial={s.q} />
      </aside>
    </div>
  );
}

function GlobalSearchPanel({ initial }: { initial?: string }) {
  const [q, setQ] = useState(initial ?? "");
  const fn = useServerFn(globalSearchFn);
  const search = useMutation({
    mutationFn: (concept: string) => fn({ data: { concept } }),
    onError: (e: Error) => toast.error(e.message),
  });
  useEffect(() => { if (initial) search.mutate(initial); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <Card className="p-4">
      <h3 className="font-display text-lg mb-3 flex items-center gap-2"><Search className="h-4 w-4 text-gold" /> Pesquisa de Conhecimento</h3>
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) search.mutate(q.trim()); }} className="flex gap-2 mb-3">
        <Input placeholder="ex.: Realismo" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" size="sm" disabled={!q.trim() || search.isPending}>Pesquisar</Button>
      </form>
      {search.isPending && <p className="text-xs text-muted-foreground">A procurar…</p>}
      {search.data && (
        <div className="space-y-3 text-sm">
          {search.data.occurrences.length === 0 ? (
            <p className="text-muted-foreground">Sem ocorrências encontradas.</p>
          ) : (
            <>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gold mb-1">Encontrado em</p>
                <ul className="space-y-1 text-xs">
                  {search.data.occurrences.slice(0, 10).map((o, i) => (
                    <li key={i} className="border-l-2 border-gold/40 pl-2">
                      <div className="font-display">{o.course} › {o.module} › {o.lesson}</div>
                      <div className="text-muted-foreground italic">{o.excerpt}</div>
                    </li>
                  ))}
                </ul>
              </div>
              {search.data.resumo_consolidado && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gold mb-1">Resumo consolidado</p>
                  <p className="font-serif whitespace-pre-wrap">{search.data.resumo_consolidado}</p>
                </div>
              )}
              {search.data.ideias_relacionadas && search.data.ideias_relacionadas.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gold mb-1">Ideias relacionadas</p>
                  <div className="flex flex-wrap gap-1">
                    {search.data.ideias_relacionadas.map((i, idx) => (
                      <span key={idx} className="text-xs px-2 py-0.5 rounded bg-secondary">{i}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}