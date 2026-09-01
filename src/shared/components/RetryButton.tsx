import { RefreshCw } from "lucide-react";

interface RetryButtonProps {
  onRetry: () => void;
  className?: string;
}

export function RetryButton({ onRetry, className }: RetryButtonProps) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className={
        "inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-cp-surface px-3 text-xs font-medium text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors focus-ring " +
        (className ?? "")
      }
    >
      <RefreshCw size={14} aria-hidden="true" />
      Reintentar
    </button>
  );
}
