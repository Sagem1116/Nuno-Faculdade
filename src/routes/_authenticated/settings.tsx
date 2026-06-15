import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProfile, updateProfile, exportAll, importAll } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Reitoria — Universidade Digital" }] }),
  component: Settings,
});

function Settings() {
  const qc = useQueryClient();
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [year, setYear] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.university_name);
      setLogo(profile.university_logo ?? "");
      setYear(profile.academic_year);
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: () => updateProfile({ university_name: name, university_logo: logo || null, academic_year: year }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); toast.success("Universidade actualizada."); },
  });

  const onExport = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `universidade-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Backup gerado.");
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAll(data);
      qc.invalidateQueries();
      toast.success("Dados importados.");
    } catch (err) {
      toast.error("Falhou: " + (err instanceof Error ? err.message : "erro"));
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 space-y-6">
      <header>
        <p className="ornate-divider text-xs uppercase tracking-[0.3em] mb-3 text-gold max-w-sm"><span>Reitoria</span></p>
        <h1 className="font-display text-4xl">Definições da universidade</h1>
      </header>

      <Card className="p-6 space-y-4">
        <h2 className="font-display text-xl">Identidade</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome da universidade</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Ano académico</Label>
            <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025/2026" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Logótipo (URL)</Label>
          <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…" />
          {logo && <img src={logo} alt="" className="h-16 w-16 rounded-md object-cover gold-frame mt-2" />}
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Guardar alterações</Button>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-display text-xl">Backup & Restauro</h2>
        <p className="text-sm text-muted-foreground">Exporta todos os teus cursos, módulos e aulas para um ficheiro JSON. Importa para restaurar ou migrar.</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onExport}><Download className="h-4 w-4 mr-2" /> Exportar JSON</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Importar JSON</Button>
          <input ref={fileRef} type="file" accept="application/json" onChange={onImport} className="hidden" />
        </div>
      </Card>
    </div>
  );
}