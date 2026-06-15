import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addExternalVideo, deleteDocument, getSignedUrl, listDocuments, uploadDocument, type LessonDocument } from "@/lib/documents";
import { summarizeDocumentFn } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FileText, Film, Link as LinkIcon, Trash2, Upload, Sparkles, Download } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export function DocumentsTab({ lessonId, courseId }: { lessonId: string; courseId: string }) {
  const qc = useQueryClient();
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["docs", lessonId], queryFn: () => listDocuments(lessonId),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoName, setVideoName] = useState("");

  const upload = useMutation({
    mutationFn: async (file: File) => uploadDocument({
      file, lessonId, courseId, onProgress: setProgress,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["docs", lessonId] }); toast.success("Documento carregado."); setProgress(null); },
    onError: (e: Error) => { toast.error(e.message); setProgress(null); },
  });

  const addVideo = useMutation({
    mutationFn: () => addExternalVideo({ url: videoUrl, name: videoName || videoUrl, lessonId, courseId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["docs", lessonId] }); setVideoUrl(""); setVideoName(""); toast.success("Vídeo adicionado."); },
  });

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="font-display text-lg mb-3 flex items-center gap-2"><Upload className="h-4 w-4 text-gold" /> Carregar ficheiro ou vídeo</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-muted-foreground mb-2">PDF, DOCX, TXT, MD ou vídeos (MP4, WebM…). O texto é extraído automaticamente para a IA.</p>
            <input
              ref={fileRef} type="file" className="hidden"
              accept=".pdf,.docx,.txt,.md,video/*,application/pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
              <Upload className="h-4 w-4 mr-1" /> Escolher ficheiro
            </Button>
            {progress !== null && <Progress value={progress} className="mt-3" />}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Ou adiciona um link de vídeo (YouTube, Vimeo, …).</p>
            <div className="space-y-2">
              <Input placeholder="https://…" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
              <Input placeholder="Nome (opcional)" value={videoName} onChange={(e) => setVideoName(e.target.value)} />
              <Button variant="outline" onClick={() => addVideo.mutate()} disabled={!videoUrl.trim()}>
                <LinkIcon className="h-4 w-4 mr-1" /> Adicionar link
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">A carregar…</p>
      ) : docs.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Sem documentos nesta aula ainda.</Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {docs.map((d) => <DocumentRow key={d.id} doc={d} />)}
        </div>
      )}
    </div>
  );
}

function DocumentRow({ doc }: { doc: LessonDocument }) {
  const qc = useQueryClient();
  const summarize = useServerFn(summarizeDocumentFn);
  const sum = useMutation({
    mutationFn: () => summarize({ data: { documentId: doc.id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["docs", doc.lesson_id] }); toast.success("Resumo gerado."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => deleteDocument(doc),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["docs", doc.lesson_id] }),
  });

  const open = async () => {
    if (doc.external_url) { window.open(doc.external_url, "_blank"); return; }
    if (doc.storage_path) {
      const url = await getSignedUrl(doc.storage_path);
      window.open(url, "_blank");
    }
  };

  const Icon = doc.kind === "video" ? Film : doc.kind === "link" ? LinkIcon : FileText;
  const summary = doc.summary as null | { resumo_curto?: string; conceitos_principais?: string[]; palavras_chave?: string[]; perguntas_possiveis?: string[] };

  return (
    <Card className="p-4 group">
      <div className="flex items-start gap-3">
        <div className="rounded bg-secondary p-2"><Icon className="h-4 w-4 text-burgundy" /></div>
        <div className="flex-1 min-w-0">
          <p className="font-serif truncate" title={doc.name}>{doc.name}</p>
          <div className="text-[11px] text-muted-foreground flex gap-2 mt-1">
            <Badge variant="secondary" className="text-[10px]">{doc.kind}</Badge>
            {doc.size_bytes && <span>{(doc.size_bytes / 1024).toFixed(0)} KB</span>}
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={open} title="Abrir"><Download className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Apagar documento?")) del.mutate(); }} className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {doc.text_content && (
        <div className="mt-3">
          {!summary ? (
            <Button size="sm" variant="outline" onClick={() => sum.mutate()} disabled={sum.isPending}>
              <Sparkles className="h-3.5 w-3.5 mr-1" /> {sum.isPending ? "A resumir…" : "Gerar resumo"}
            </Button>
          ) : (
            <div className="text-sm font-serif space-y-2 border-t pt-3">
              <p>{summary.resumo_curto}</p>
              {summary.conceitos_principais && (
                <p className="text-xs text-muted-foreground"><b>Conceitos:</b> {summary.conceitos_principais.join(", ")}</p>
              )}
              {summary.palavras_chave && (
                <p className="text-xs text-muted-foreground"><b>Palavras-chave:</b> {summary.palavras_chave.join(", ")}</p>
              )}
              <Button size="sm" variant="ghost" onClick={() => sum.mutate()} disabled={sum.isPending}>Re-gerar</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}