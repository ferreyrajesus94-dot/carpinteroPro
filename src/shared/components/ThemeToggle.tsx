import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/shared/lib/utils";

interface ThemeToggleProps {
  variant?: "icon" | "label";
  className?: string;
}

export function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;

  if (variant === "label") {
    return (
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-md border border-line bg-cp-surface px-3 text-sm text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors focus-ring",
          className
        )}
        aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
      >
        <Icon size={16} className="inline-block shrink-0 align-middle" aria-hidden="true" />
        {isDark ? "Modo claro" : "Modo oscuro"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
      className={cn(
        "grid place-items-center rounded-md text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors cursor-pointer focus-ring",
        className
      )}
    >
      <Icon size={16} className="inline-block shrink-0 align-middle" aria-hidden="true" />
    </button>
  );
}
