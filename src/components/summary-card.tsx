import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useState } from "react";

export function SummaryCard({
  title, summary, onGenerate, loading,
}: {
  title: string;
  summary: Record<string, unknown> | null;
  onGenerate: () => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(true);
  if (!summary) {
    return (
      <Card className="p-5 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground">Sem resumo ainda. A IA pode analisar todos os conteúdos e gerar um.</p>
        </div>
        <Button onClick={onGenerate} disabled={loading}><Sparkles className="h-4 w-4 mr-1" /> {loading ? "A gerar…" : title}</Button>
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg">{title}</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>{open ? "Esconder" : "Mostrar"}</Button>
          <Button size="sm" variant="outline" onClick={onGenerate} disabled={loading}><Sparkles className="h-3.5 w-3.5 mr-1" />{loading ? "A gerar…" : "Re-gerar"}</Button>
        </div>
      </div>
      {open && <SummaryView data={summary} />}
    </Card>
  );
}

function SummaryView({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-3 font-serif text-sm">
      {Object.entries(data).map(([k, v]) => (
        <div key={k}>
          <div className="text-xs uppercase tracking-widest text-gold mb-1">{k.replace(/_/g, " ")}</div>
          <RenderValue v={v} />
        </div>
      ))}
    </div>
  );
}

function RenderValue({ v }: { v: unknown }) {
  if (v == null) return null;
  if (typeof v === "string") return <p className="whitespace-pre-wrap">{v}</p>;
  if (Array.isArray(v)) {
    return (
      <ul className="list-disc pl-5 space-y-1">
        {v.map((it, i) => (
          <li key={i}>{typeof it === "string" ? it : typeof it === "object" && it && "termo" in it ? (
            <><b>{(it as { termo: string }).termo}:</b> {(it as { definicao: string }).definicao}</>
          ) : JSON.stringify(it)}</li>
        ))}
      </ul>
    );
  }
  return <pre className="text-xs bg-secondary/40 p-2 rounded">{JSON.stringify(v, null, 2)}</pre>;
}