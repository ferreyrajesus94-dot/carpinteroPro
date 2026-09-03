import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/shared/lib/utils";

export type SidebarNavVariant =
	| "row-icon"
	| "icon-square"
	| "bottom-tab"
	| "chip";

interface SidebarNavLinkProps {
	to: string;
	label?: ReactNode;
	icon?: string;
	end?: boolean;
	variant: SidebarNavVariant;
	badge?: { count: number; tone: "danger" | "warn" | "info" };
	onClick?: () => void;
	as?: "link" | "button";
	className?: string;
}

const variantStyles: Record<SidebarNavVariant, { base: string; active: string; layout: string }> = {
	"row-icon": {
		base: "text-ink2 hover:bg-cp-bg2 hover:text-ink",
		active: "bg-cp-accent-soft text-cp-accent",
		layout: "flex items-center gap-3 rounded-md px-3 h-9 text-[13.5px] font-medium",
	},
	"icon-square": {
		base: "text-ink2 hover:bg-cp-bg2 hover:text-ink",
		active: "bg-cp-accent-soft text-cp-accent",
		layout: "grid h-11 w-11 place-items-center rounded-md",
	},
	"bottom-tab": {
		base: "text-ink3 hover:text-ink2",
		active: "text-ink",
		layout: "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium",
	},
	chip: {
		base: "text-ink2",
		active: "bg-cp-accent text-[var(--cp-accent-ink)] border-cp-accent",
		layout: "inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs",
	},
};

const badgeStyle: Record<"danger" | "warn" | "info", string> = {
	danger: "ml-auto rounded-full bg-cp-danger/15 px-1.5 py-0.5 text-[10px] font-bold text-cp-danger leading-none",
	warn: "ml-auto rounded-full bg-cp-warn/15 px-1.5 py-0.5 text-[10px] font-bold text-cp-warn leading-none",
	info: "ml-auto rounded-full bg-cp-info/15 px-1.5 py-0.5 text-[10px] font-bold text-cp-info leading-none",
};

export function SidebarNavLink({
	to,
	label,
	icon,
	end,
	variant,
	badge,
	onClick,
	as = "link",
	className,
}: SidebarNavLinkProps) {
	const styles = variantStyles[variant];
	const iconEl = icon && (
		<i className={cn("fi text-base leading-none shrink-0", icon)} aria-hidden="true" />
	);

	const classNameFor = ({ isActive }: { isActive: boolean }) =>
		cn(
			styles.layout,
			"transition-colors focus-ring",
			isActive ? styles.active : styles.base,
			className,
		);

	const inner = (
		<>
			{iconEl}
			{label && (variant === "bottom-tab" ? (
				<span className={cn("font-medium")}>{label}</span>
			) : (
				<span>{label}</span>
			))}
			{badge && badge.count > 0 && (
				<span className={badgeStyle[badge.tone]}>{badge.count}</span>
			)}
		</>
	);

	if (as === "button") {
		return (
			<button
				type="button"
				onClick={onClick}
				className={cn(styles.layout, "transition-colors focus-ring", className)}
			>
				{inner}
			</button>
		);
	}

	return (
		<NavLink
			to={to}
			end={end}
			onClick={onClick}
			className={classNameFor}
		>
			{inner}
		</NavLink>
	);
}
