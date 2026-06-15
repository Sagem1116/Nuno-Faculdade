import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, BookOpen, Library, Compass } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Universidade Digital" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/campus" replace />;

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/campus` },
        });
        if (error) throw error;
        toast.success("Matrícula efectuada. Já podes entrar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/campus" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/campus" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — atmosphere */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 text-primary-foreground"
           style={{ background: "linear-gradient(160deg, oklch(0.22 0.03 40), oklch(0.32 0.05 35) 60%, oklch(0.18 0.025 40))" }}>
        <div className="flex items-center gap-3 font-display text-xl">
          <div className="h-10 w-10 grid place-items-center rounded-md gold-frame bg-burgundy">
            <GraduationCap className="h-5 w-5 text-gold" />
          </div>
          <span>Universidade Digital</span>
        </div>
        <div className="space-y-6">
          <p className="ornate-divider text-xs uppercase tracking-[0.3em]"><span>Anno MMXXVI</span></p>
          <h1 className="font-display text-5xl xl:text-6xl leading-[1.05]">
            Estuda como se estivesses<br />numa verdadeira universidade.
          </h1>
          <p className="text-base text-primary-foreground/80 max-w-md font-serif italic">
            "Sapere aude." Cria os teus cursos, organiza módulos e aulas,
            mantém notas e reflexões — tudo num ambiente que respeita o teu estudo.
          </p>
          <div className="grid grid-cols-3 gap-4 text-xs text-primary-foreground/70 max-w-md">
            <Feature icon={<Library className="h-4 w-4" />} label="Biblioteca de cursos" />
            <Feature icon={<BookOpen className="h-4 w-4" />} label="Caderno editor" />
            <Feature icon={<Compass className="h-4 w-4" />} label="Reflexão guiada" />
          </div>
        </div>
        <p className="text-xs text-primary-foreground/50 font-serif italic">— Veritas in studio —</p>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="ornate-divider text-xs uppercase tracking-[0.3em] mb-6 text-gold">
            <span>{mode === "signin" ? "Entrar no Campus" : "Nova Matrícula"}</span>
          </div>
          <h2 className="font-display text-3xl mb-2">
            {mode === "signin" ? "Bem-vindo de volta" : "Junta-te à universidade"}
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            {mode === "signin" ? "Acede aos teus cursos, notas e reflexões." : "Em segundos crias o teu campus pessoal."}
          </p>

          <Button variant="outline" onClick={onGoogle} disabled={busy} className="w-full mb-4 border-border/80">
            <GoogleIcon /> Continuar com Google
          </Button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">ou e-mail</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={onEmail} className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail académico</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aluno@exemplo.pt" />
            </div>
            <div className="space-y-2">
              <Label>Palavra-passe</Label>
              <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground mt-6 text-center">
            {mode === "signin" ? "Ainda não és aluno? " : "Já tens conta? "}
            <button
              className="text-burgundy underline underline-offset-4 decoration-gold decoration-2"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Matricula-te" : "Entrar"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 border border-primary-foreground/15 rounded px-2 py-2">
      <span className="text-gold">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.23 1.05-3.71 1.05-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.11A6.97 6.97 0 0 1 5.48 12c0-.73.13-1.45.36-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.95l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}