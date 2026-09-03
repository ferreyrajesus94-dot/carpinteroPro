import type { ReactNode, ElementType } from "react";
import { cn } from "@/shared/lib/utils";

export type EyebrowVariant = "sans" | "mono";
export type EyebrowTone = "muted" | "danger" | "warn";

interface EyebrowProps {
	children: ReactNode;
	variant?: EyebrowVariant;
	tone?: EyebrowTone;
	as?: ElementType;
	className?: string;
}

export function Eyebrow({
	children,
	variant = "sans",
	tone = "muted",
	as: Tag = "span",
	className,
}: EyebrowProps) {
	const variantClass = {
		sans: "text-xs uppercase tracking-wider font-medium",
		mono: "font-mono text-[11px] uppercase tracking-[0.08em] font-medium",
	}[variant];
	const toneClass = {
		muted: "text-ink3",
		danger: "text-cp-danger",
		warn: "text-cp-warn",
	}[tone];

	return (
		<Tag className={cn(variantClass, toneClass, className)}>{children}</Tag>
	);
}
