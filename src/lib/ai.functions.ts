import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createGateway, DEFAULT_MODEL } from "./ai-gateway.server";
import { tiptapText, truncate } from "./knowledge";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient };

function key() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("Missing LOVABLE_API_KEY");
  return k;
}

async function getLesson(ctx: Ctx, id: string) {
  const { data } = await ctx.supabase.from("lessons").select("*").eq("id", id).maybeSingle();
  return data;
}
async function getModule(ctx: Ctx, id: string) {
  const { data } = await ctx.supabase.from("modules").select("*").eq("id", id).maybeSingle();
  return data;
}
async function getCourse(ctx: Ctx, id: string) {
  const { data } = await ctx.supabase.from("courses").select("*").eq("id", id).maybeSingle();
  return data;
}
async function getDoc(ctx: Ctx, id: string) {
  const { data } = await ctx.supabase.from("lesson_documents").select("*").eq("id", id).maybeSingle();
  return data;
}

function lessonText(l: { title: string; content: unknown; notes: unknown; reflection: unknown }) {
  const matter = tiptapText(l.content);
  const notes = Array.isArray(l.notes) ? (l.notes as Array<{ text: string }>).map((n) => `- ${n.text}`).join("\n") : "";
  const r = (l.reflection ?? {}) as Record<string, string>;
  const reflection = Object.entries(r).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
  return `# Aula: ${l.title}\n\n## Matéria\n${matter}\n\n## Notas\n${notes}\n\n## Reflexão\n${reflection}`;
}

async function buildLessonContext(ctx: Ctx, lessonId: string) {
  const l = await getLesson(ctx, lessonId);
  if (!l) return "";
  const { data: docs } = await ctx.supabase.from("lesson_documents").select("name,text_content,summary").eq("lesson_id", lessonId);
  const docTexts = (docs ?? []).map((d) => `### Documento: ${d.name}\n${d.text_content ?? ""}`).join("\n\n");
  return `${lessonText(l as never)}\n\n## Documentos\n${docTexts}`;
}

async function buildModuleContext(ctx: Ctx, moduleId: string) {
  const m = await getModule(ctx, moduleId);
  if (!m) return "";
  const { data: lessons } = await ctx.supabase.from("lessons").select("*").eq("module_id", moduleId).order("position");
  const parts = await Promise.all((lessons ?? []).map((l) => buildLessonContext(ctx, l.id)));
  return `# Módulo: ${m.title}\n\n${parts.join("\n\n---\n\n")}`;
}

async function buildCourseContext(ctx: Ctx, courseId: string) {
  const c = await getCourse(ctx, courseId);
  if (!c) return "";
  const { data: modules } = await ctx.supabase.from("modules").select("*").eq("course_id", courseId).order("position");
  const parts = await Promise.all((modules ?? []).map((m) => buildModuleContext(ctx, m.id)));
  return `# Curso: ${c.name}\n${c.description ?? ""}\n\n${parts.join("\n\n===\n\n")}`;
}

async function buildFullContext(ctx: Ctx, scopeCourseId?: string | null) {
  if (scopeCourseId) return buildCourseContext(ctx, scopeCourseId);
  const { data: courses } = await ctx.supabase.from("courses").select("*").order("position");
  const parts = await Promise.all((courses ?? []).map((c) => buildCourseContext(ctx, c.id)));
  return parts.join("\n\n#####\n\n");
}

// ─── Server functions ────────────────────────────────────────────────

export const summarizeLessonFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lessonId: string }) => z.object({ lessonId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const text = await buildLessonContext(context, data.lessonId);
    const g = createGateway(key());
    const prompt = `Es um assistente académico. Analisa esta aula e devolve **JSON estrito** com os campos:
{
  "resumo": "string (3-6 parágrafos)",
  "conceitos": ["string"],
  "questoes_revisao": ["string"],
  "pontos_pouco_desenvolvidos": ["string"]
}
Apenas JSON, sem markdown.

CONTEÚDO:
${truncate(text, 12000)}`;
    const { text: out } = await generateText({ model: g(DEFAULT_MODEL), prompt });
    const json = safeJson(out);
    await context.supabase.from("lessons").update({ summary: json as never }).eq("id", data.lessonId);
    return json;
  });

export const summarizeModuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { moduleId: string }) => z.object({ moduleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const text = await buildModuleContext(context, data.moduleId);
    const g = createGateway(key());
    const { text: out } = await generateText({
      model: g(DEFAULT_MODEL),
      prompt: `Analisa este módulo e devolve **JSON estrito**:
{ "sintese": "string", "conceitos_centrais": ["string"], "ligacoes_entre_aulas": "string", "questoes_revisao": ["string"] }
Apenas JSON.

CONTEÚDO:
${truncate(text, 15000)}`,
    });
    const json = safeJson(out);
    await context.supabase.from("modules").update({ summary: json as never }).eq("id", data.moduleId);
    return json;
  });

export const summarizeCourseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string }) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const text = await buildCourseContext(context, data.courseId);
    const g = createGateway(key());
    const { text: out } = await generateText({
      model: g(DEFAULT_MODEL),
      prompt: `Analisa este curso completo e devolve **JSON estrito**:
{
  "resumo_executivo": "string",
  "conceitos_fundamentais": ["string"],
  "cronologia": ["string"],
  "relacoes_entre_conceitos": "string",
  "glossario": [{ "termo": "string", "definicao": "string" }],
  "perguntas_exame": ["string"]
}
Apenas JSON.

CONTEÚDO:
${truncate(text, 18000)}`,
    });
    const json = safeJson(out);
    await context.supabase.from("courses").update({ summary: json as never }).eq("id", data.courseId);
    return json;
  });

export const summarizeDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { documentId: string }) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const doc = await getDoc(context, data.documentId);
    if (!doc || !doc.text_content) throw new Error("Sem texto extraído deste documento.");
    const g = createGateway(key());
    const { text: out } = await generateText({
      model: g(DEFAULT_MODEL),
      prompt: `Analisa este documento e devolve **JSON estrito**:
{
  "resumo_curto": "string (2-3 frases)",
  "resumo_medio": "string (1-2 parágrafos)",
  "resumo_completo": "string (vários parágrafos)",
  "conceitos_principais": ["string"],
  "palavras_chave": ["string"],
  "perguntas_possiveis": ["string"]
}
Apenas JSON.

DOCUMENTO (${doc.name}):
${truncate(doc.text_content, 18000)}`,
    });
    const json = safeJson(out);
    await context.supabase.from("lesson_documents").update({ summary: json as never }).eq("id", data.documentId);
    return json;
  });

export const globalSearchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { concept: string }) => z.object({ concept: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    // Find occurrences across all lessons
    const { data: courses } = await context.supabase.from("courses").select("id,name");
    const { data: modules } = await context.supabase.from("modules").select("id,course_id,title");
    const { data: lessons } = await context.supabase.from("lessons").select("id,course_id,module_id,title,content,notes,reflection");
    const { data: docs } = await context.supabase.from("lesson_documents").select("id,lesson_id,name,text_content");
    const needle = data.concept.toLowerCase();
    const cMap = new Map((courses ?? []).map((c) => [c.id, c.name] as const));
    const mMap = new Map((modules ?? []).map((m) => [m.id, m.title] as const));
    const occurrences: { course: string; module: string; lesson: string; lesson_id: string; excerpt: string }[] = [];
    for (const l of lessons ?? []) {
      const blob = lessonText(l as never).toLowerCase();
      if (blob.includes(needle)) {
        const idx = blob.indexOf(needle);
        const excerpt = blob.slice(Math.max(0, idx - 120), idx + 280).replace(/\s+/g, " ");
        occurrences.push({
          course: cMap.get(l.course_id) ?? "—",
          module: mMap.get(l.module_id) ?? "—",
          lesson: l.title,
          lesson_id: l.id,
          excerpt: "…" + excerpt + "…",
        });
      }
    }
    for (const d of docs ?? []) {
      const t = (d.text_content ?? "").toLowerCase();
      if (t.includes(needle)) {
        const lesson = (lessons ?? []).find((l) => l.id === d.lesson_id);
        if (!lesson) continue;
        const idx = t.indexOf(needle);
        const excerpt = t.slice(Math.max(0, idx - 120), idx + 280).replace(/\s+/g, " ");
        occurrences.push({
          course: cMap.get(lesson.course_id) ?? "—",
          module: mMap.get(lesson.module_id) ?? "—",
          lesson: `${lesson.title} (doc: ${d.name})`,
          lesson_id: lesson.id,
          excerpt: "…" + excerpt + "…",
        });
      }
    }

    const corpus = occurrences.map((o) => `[${o.course} > ${o.module} > ${o.lesson}]\n${o.excerpt}`).join("\n\n");
    const g = createGateway(key());
    const { text: out } = await generateText({
      model: g(DEFAULT_MODEL),
      prompt: `Es um assistente académico. O utilizador procurou o conceito: "${data.concept}".
Com base APENAS nas ocorrências abaixo encontradas na universidade do utilizador, devolve **JSON estrito**:
{ "resumo_consolidado": "string", "ideias_relacionadas": ["string"] }
Se não houver ocorrências relevantes, devolve resumo_consolidado vazio.

OCORRÊNCIAS:
${truncate(corpus, 14000)}`,
    });
    const synth = safeJson(out) as { resumo_consolidado?: string; ideias_relacionadas?: string[] };
    return {
      occurrences,
      resumo_consolidado: synth.resumo_consolidado ?? "",
      ideias_relacionadas: synth.ideias_relacionadas ?? [],
    };
  });

export const askAssistantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { question: string; history?: Array<{ role: "user" | "assistant"; content: string }>; courseId?: string | null }) =>
    z.object({
      question: z.string().min(1).max(2000),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(40).optional(),
      courseId: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const kb = await buildFullContext(context, data.courseId ?? null);
    const g = createGateway(key());
    const system = `És o Assistente Académico da Universidade Digital do utilizador.
Responde sempre em português europeu, em markdown, com base **exclusivamente** nos conteúdos da universidade abaixo (cursos, módulos, aulas, matéria, notas, reflexões e documentos carregados). Se a informação não estiver presente, diz claramente: "Isso ainda não consta nos teus apontamentos." Cita sempre a fonte no formato "(Curso > Módulo > Aula)".

CONTEÚDOS DISPONÍVEIS:
${truncate(kb, 22000)}`;
    const messages = [
      { role: "system" as const, content: system },
      ...((data.history ?? []).map((m) => ({ role: m.role, content: m.content }))),
      { role: "user" as const, content: data.question },
    ];
    const { text } = await generateText({ model: g(DEFAULT_MODEL), messages });
    return { answer: text };
  });

// ─── Concept Map ────────────────────────────────────────────────────

export const generateConceptMapFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string; central?: string }) =>
    z.object({ courseId: z.string().uuid(), central: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const course = await getCourse(context, data.courseId);
    if (!course) throw new Error("Curso não encontrado.");
    const text = await buildCourseContext(context, data.courseId);
    const { data: lessons } = await context.supabase
      .from("lessons").select("id,title").eq("course_id", data.courseId);
    const lessonList = (lessons ?? []).map((l) => `- ${l.id} :: ${l.title}`).join("\n");
    const g = createGateway(key());
    const prompt = `És um cartógrafo de conhecimento académico. Constrói um mapa de conceitos hierárquico para o curso "${course.name}".
Conceito central pedido: "${data.central || course.name}".
Devolve APENAS JSON estrito (sem markdown) no formato:
{
  "central": "string",
  "subconceitos": [
    {
      "label": "string",
      "descricao": "string curta",
      "relacionados": [
        {
          "label": "string",
          "descricao": "string curta",
          "aulas": [{ "lesson_id": "uuid-da-lista-abaixo", "title": "string" }]
        }
      ]
    }
  ]
}
Regras:
- Entre 4 e 7 subconceitos. Entre 2 e 4 relacionados por subconceito.
- Cada "lesson_id" deve corresponder EXACTAMENTE a um id da lista de aulas. Se uma aula não se aplica, omite-a.
- Usa apenas conteúdos da matéria do utilizador.

AULAS DISPONÍVEIS (id :: título):
${lessonList}

CONTEÚDO DO CURSO:
${truncate(text, 16000)}`;
    const { text: out } = await generateText({ model: g(DEFAULT_MODEL), prompt });
    const json = safeJson(out);
    await context.supabase.from("concept_maps")
      .upsert({ user_id: (context as unknown as { userId: string }).userId, course_id: data.courseId, data: json as never }, { onConflict: "course_id" });
    return json;
  });

export const getConceptMapFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string }) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("concept_maps").select("data,updated_at").eq("course_id", data.courseId).maybeSingle();
    return row ?? null;
  });

function safeJson(s: string): JsonObject {
  // Strip fenced code blocks if any
  const cleaned = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(cleaned) as JsonObject; } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]) as JsonObject; } catch { /* noop */ }
    return { raw: s };
  }
}