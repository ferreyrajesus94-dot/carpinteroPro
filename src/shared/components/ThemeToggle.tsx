import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/shared/lib/utils";

interface ThemeToggleProps {
  variant?: "icon" | "label";
  className?: string;
}

export function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

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
        <i className={cn("fi text-base leading-none", isDark ? "fi-rr-sun" : "fi-rr-moon")} aria-hidden="true" />
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
      <i className={cn("fi text-base leading-none", isDark ? "fi-rr-sun" : "fi-rr-moon")} aria-hidden="true" />
    </button>
  );
}
