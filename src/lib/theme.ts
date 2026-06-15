import { useEffect, useState, useCallback } from "react";

export type ThemeId = "parchment" | "parchment-dark" | "midnight";

export const THEMES: { id: ThemeId; label: string; description: string; swatch: string[] }[] = [
  { id: "parchment", label: "Pergaminho de Oxford", description: "Papel envelhecido, tinta sépia, ouro discreto.", swatch: ["#f3ead4", "#c9a84c", "#5c2018"] },
  { id: "parchment-dark", label: "Biblioteca à noite", description: "Madeira escura com pergaminho dourado.", swatch: ["#241c14", "#c9a84c", "#f5e9c8"] },
  { id: "midnight", label: "Azul-meia-noite", description: "Fundo azul profundo com letras e acabamentos dourados.", swatch: ["#0a1430", "#d4af37", "#f5e9c8"] },
];

const KEY = "ud-theme";

export function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "theme-midnight");
  if (id === "parchment-dark") root.classList.add("dark");
  if (id === "midnight") root.classList.add("dark", "theme-midnight");
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
}

export function readTheme(): ThemeId {
  if (typeof window === "undefined") return "parchment";
  try {
    const v = localStorage.getItem(KEY) as ThemeId | null;
    if (v === "parchment" || v === "parchment-dark" || v === "midnight") return v;
  } catch { /* ignore */ }
  return "parchment";
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>("parchment");
  useEffect(() => {
    const t = readTheme();
    setThemeState(t);
    applyTheme(t);
  }, []);
  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    applyTheme(id);
  }, []);
  return { theme, setTheme };
}