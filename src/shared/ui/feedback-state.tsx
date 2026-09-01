import { type ReactNode } from "react";
import { AlertTriangle, Inbox, SearchX, WifiOff, type LucideIcon } from "lucide-react";

/* ─── Constants ─────────────────────────────────────────── */

const EMPTY_STATE_VARIANT = {
  NO_RESULTS: "no-results",
  EMPTY_FEATURE: "empty-feature",
  UNAVAILABLE: "unavailable",
} as const;

type EmptyStateVariant =
  (typeof EMPTY_STATE_VARIANT)[keyof typeof EMPTY_STATE_VARIANT];

const EMPTY_DEFAULT_DESCRIPTIONS: Record<EmptyStateVariant, string> = {
  [EMPTY_STATE_VARIANT.NO_RESULTS]: "No encontramos resultados para tu búsqueda.",
  [EMPTY_STATE_VARIANT.EMPTY_FEATURE]: "Todavía no hay nada acá.",
  [EMPTY_STATE_VARIANT.UNAVAILABLE]: "Esta sección no está disponible en este momento.",
};

const EMPTY_ICONS: Record<EmptyStateVariant, typeof Inbox> = {
  [EMPTY_STATE_VARIANT.NO_RESULTS]: SearchX,
  [EMPTY_STATE_VARIANT.EMPTY_FEATURE]: Inbox,
  [EMPTY_STATE_VARIANT.UNAVAILABLE]: WifiOff,
};

/* ─── Props ──────────────────────────────────────────────── */

interface FeedbackStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

interface EmptyStateProps extends FeedbackStateProps {
  variant: EmptyStateVariant;
  /**
   * Optional override for the variant icon. When provided, this icon is used
   * instead of the variant's default. Preserves the older EmptyState API that
   * required a single icon prop (e.g. for feature-specific empty states).
   */
  icon?: LucideIcon;
}

interface LoadingStateProps {
  label?: string;
}

/* ─── Components ─────────────────────────────────────────── */

export function ErrorState({ title, description, action }: FeedbackStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-cp-bg2 p-8 text-center"
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-cp-danger/10">
        <AlertTriangle className="h-6 w-6 text-cp-danger" aria-hidden="true" />
      </span>
      <div>
        <p className="font-medium text-ink">{title}</p>
        {description && (
          <p className="mt-1 text-[13px] text-ink3">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function EmptyState({
  variant,
  title,
  description,
  action,
  icon,
}: EmptyStateProps) {
  const Icon = icon ?? EMPTY_ICONS[variant];
  const descriptionText = description ?? EMPTY_DEFAULT_DESCRIPTIONS[variant];

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-cp-bg2 p-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-cp-accent-soft">
        <Icon className="h-5 w-5 text-cp-accent" aria-hidden="true" />
      </span>
      <div>
        <p className="font-medium text-ink">{title}</p>
        <p className="mt-1 text-[13px] text-ink3">{descriptionText}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex flex-col items-center justify-center gap-3 py-12"
    >
      <svg
        className="h-8 w-8 animate-spin text-cp-accent"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {label && <p className="text-sm text-ink2">{label}</p>}
    </div>
  );
}
