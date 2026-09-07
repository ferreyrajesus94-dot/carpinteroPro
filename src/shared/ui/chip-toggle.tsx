import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export type ChipToggleVariant = "filter" | "tab" | "category" | "nav-chip";
export type ChipToggleBadgeTone = "neutral" | "accent" | "danger";
/**
 * `button` (default) renders an `aria-pressed` toggle, the right fit for
 * independent filter / category chips that can each be flipped on or off.
 * `radio` renders an `aria-checked` element for use inside a `role="radiogroup"`
 * parent (e.g. the dashboard period selector) — the parent controls
 * single-selection semantics and keyboard arrow navigation.
 */
export type ChipToggleRole = "button" | "radio";

interface ChipToggleProps {
	variant: ChipToggleVariant;
	active: boolean;
	onSelect: () => void;
	icon?: ReactNode;
	label: ReactNode;
	count?: number;
	badgeTone?: ChipToggleBadgeTone;
	ariaLabel?: string;
	className?: string;
	/**
	 * ARIA role for the underlying button. When set to `"radio"`, the element
	 * renders with `role="radio"` + `aria-checked` instead of `aria-pressed`,
	 * which is what a parent `role="radiogroup"` expects.
	 */
	role?: ChipToggleRole;
}

const containerStyles: Record<ChipToggleVariant, { base: string; active: string }> = {
	filter: {
		base: "rounded-md px-3 py-1.5 text-[12.5px] text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors",
		active: "bg-cp-accent-soft text-cp-accent",
	},
	tab: {
		base: "flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] text-ink3 hover:text-ink transition-colors",
		active: "bg-cp-surface text-ink shadow-sm",
	},
	category: {
		base: "rounded-full border border-line bg-cp-surface px-3 py-1 text-[12px] text-ink3 hover:border-line2 transition-colors",
		active: "border-cp-accent bg-cp-accent-soft text-cp-accent",
	},
	"nav-chip": {
		base: "inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-ink2 transition-colors",
		active: "bg-cp-accent text-[var(--cp-accent-ink)] border-cp-accent",
	},
};

const badgeStyles: Record<ChipToggleBadgeTone, string> = {
	neutral: "rounded-sm bg-cp-bg2 px-1.5 py-0.5 font-mono text-[10px] text-ink3",
	accent: "rounded-full bg-cp-accent-soft px-1.5 py-0.5 text-[10px] text-cp-accent",
	danger: "rounded-full bg-cp-danger/15 px-1.5 py-0.5 text-[10px] text-cp-danger font-semibold",
};

export function ChipToggle({
	variant,
	active,
	onSelect,
	icon,
	label,
	count,
	badgeTone = "neutral",
	ariaLabel,
	className,
	role: ariaRole = "button",
}: ChipToggleProps) {
	const styles = containerStyles[variant];
	const isRadio = ariaRole === "radio";

	return (
		<button
			type="button"
			onClick={onSelect}
			role={isRadio ? "radio" : undefined}
			aria-pressed={isRadio ? undefined : active}
			aria-checked={isRadio ? active : undefined}
			aria-label={ariaLabel}
			className={cn(
				"inline-flex items-center gap-1.5 focus-ring transition-colors",
				styles.base,
				active && styles.active,
				className,
			)}
		>
			{icon}
			<span>{label}</span>
			{count !== undefined && count > 0 && (
				<span className={badgeStyles[badgeTone]}>{count}</span>
			)}
		</button>
	);
}
