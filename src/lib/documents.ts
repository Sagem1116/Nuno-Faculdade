import { supabase } from "@/integrations/supabase/client";
import mammoth from "mammoth";

export type LessonDocument = {
  id: string;
  lesson_id: string;
  course_id: string;
  user_id: string;
  name: string;
  kind: "file" | "video" | "link";
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string | null;
  external_url: string | null;
  text_content: string | null;
  summary: unknown;
  created_at: string;
};

export async function listDocuments(lessonId: string): Promise<LessonDocument[]> {
  const { data, error } = await supabase
    .from("lesson_documents").select("*").eq("lesson_id", lessonId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LessonDocument[];
}

export async function getSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from("lesson-documents").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDocument(doc: LessonDocument) {
  if (doc.storage_path) {
    await supabase.storage.from("lesson-documents").remove([doc.storage_path]);
  }
  const { error } = await supabase.from("lesson_documents").delete().eq("id", doc.id);
  if (error) throw error;
}

async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
    return await file.text();
  }
  if (name.endsWith(".docx")) {
    const buf = await file.arrayBuffer();
    const r = await mammoth.extractRawText({ arrayBuffer: buf });
    return r.value;
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url" as string)) as { default: string };
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;
    let out = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      out += tc.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
    }
    return out;
  }
  return "";
}

export async function uploadDocument(opts: {
  file: File; lessonId: string; courseId: string;
  onProgress?: (pct: number) => void;
}): Promise<LessonDocument> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");
  const isVideo = opts.file.type.startsWith("video/");
  const ext = opts.file.name.split(".").pop() ?? "bin";
  const path = `${user.id}/${opts.lessonId}/${crypto.randomUUID()}.${ext}`;
  opts.onProgress?.(10);
  const { error: upErr } = await supabase.storage.from("lesson-documents").upload(path, opts.file, {
    contentType: opts.file.type, upsert: false,
  });
  if (upErr) throw upErr;
  opts.onProgress?.(60);
  let text = "";
  if (!isVideo) {
    try { text = await extractTextFromFile(opts.file); } catch (e) { console.warn("extract failed", e); }
  }
  opts.onProgress?.(90);
  const { data, error } = await supabase.from("lesson_documents").insert({
    user_id: user.id, lesson_id: opts.lessonId, course_id: opts.courseId,
    name: opts.file.name, kind: isVideo ? "video" : "file",
    mime_type: opts.file.type, size_bytes: opts.file.size,
    storage_path: path, text_content: text || null,
  }).select("*").single();
  if (error) throw error;
  opts.onProgress?.(100);
  return data as unknown as LessonDocument;
}

export async function addExternalVideo(opts: { url: string; name: string; lessonId: string; courseId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");
  const { data, error } = await supabase.from("lesson_documents").insert({
    user_id: user.id, lesson_id: opts.lessonId, course_id: opts.courseId,
    name: opts.name, kind: "video", external_url: opts.url,
  }).select("*").single();
  if (error) throw error;
  return data as unknown as LessonDocument;
}