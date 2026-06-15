import { THEMES, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTheme(t.id)}
          className={cn(
            "relative text-left rounded-lg border p-4 transition-all hover:shadow-md",
            theme === t.id ? "border-gold ring-2 ring-gold/40" : "border-border",
          )}
        >
          <div className="flex gap-1.5 mb-3">
            {t.swatch.map((c) => (
              <span key={c} className="h-6 w-6 rounded-full border border-black/10" style={{ background: c }} />
            ))}
          </div>
          <div className="font-display text-base">{t.label}</div>
          <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
          {theme === t.id && (
            <Check className="absolute top-3 right-3 h-4 w-4 text-gold" />
          )}
        </button>
      ))}
    </div>
  );
}