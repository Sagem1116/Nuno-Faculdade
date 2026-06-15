import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Universidade Digital" },
      { name: "description", content: "A tua universidade pessoal — organiza cursos, módulos, aulas, notas e progresso." },
      { property: "og:title", content: "Universidade Digital" },
      { property: "og:description", content: "A tua universidade pessoal — organiza cursos, módulos, aulas, notas e progresso." },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
        <GraduationCap className="h-8 w-8 text-accent animate-pulse" />
        <p className="font-display text-lg">A abrir os portões da universidade…</p>
      </div>
    );
  }
  return <Navigate to={user ? "/campus" : "/auth"} replace />;
}
