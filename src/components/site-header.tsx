import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, GraduationCap, Sparkles, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "@/lib/db";
import { useState } from "react";

export function SiteHeader() {
  const navigate = useNavigate();
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const [q, setQ] = useState("");

  const onSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link to="/campus" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground gold-frame">
            {profile?.university_logo
              ? <img src={profile.university_logo} alt="" className="h-full w-full object-cover rounded-md" />
              : <GraduationCap className="h-5 w-5" />}
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg text-foreground group-hover:text-burgundy transition-colors">
              {profile?.university_name ?? "Universidade Digital"}
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Ano académico {profile?.academic_year ?? "—"}
            </div>
          </div>
        </Link>
        <form
          onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate({ to: "/assistant", search: { q: q.trim() } }); }}
          className="ml-auto hidden md:flex items-center gap-1"
        >
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar conceito…" className="h-9 pl-7 w-56" />
          </div>
        </form>
        <nav className="hidden md:flex items-center gap-1 font-display text-sm ml-2">
          {[
            { to: "/campus", label: "Campus" },
            { to: "/assistant", label: "Assistente" },
            { to: "/dashboard", label: "Dashboard" },
            { to: "/settings", label: "Reitoria" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="px-3 py-2 rounded text-foreground/80 hover:text-foreground hover:bg-secondary transition-colors"
              activeProps={{ className: "text-burgundy underline decoration-gold underline-offset-8 decoration-2" }}
            >
              {item.label === "Assistente" ? <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-gold" />{item.label}</span> : item.label}
            </Link>
          ))}
        </nav>
        <Button size="sm" variant="ghost" onClick={onSignOut} className="text-muted-foreground hover:text-burgundy">
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </div>
    </header>
  );
}