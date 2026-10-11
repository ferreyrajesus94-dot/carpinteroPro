import { Hammer } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/shared/lib/utils";

export type BrandMarkSize = "xs" | "sm" | "md" | "lg";
export type BrandMarkShape = "square" | "rounded";

interface BrandMarkProps {
	size?: BrandMarkSize;
	shape?: BrandMarkShape;
	wordmark?: boolean;
	label?: string;
	className?: string;
	href?: string;
	"aria-label"?: string;
}

export function BrandMark({
	size = "md",
	shape = "square",
	wordmark = true,
	label = "CarpinteroPro",
	className,
	href = "/",
	"aria-label": ariaLabel,
}: BrandMarkProps) {
	const sizeClass = {
		xs: "h-6 w-6",
		sm: "h-7 w-7",
		md: "h-9 w-9",
		lg: "h-10 w-10",
	}[size];
	const iconSize = { xs: 11, sm: 14, md: 16, lg: 18 }[size];
	const shapeClass = {
		square: "rounded-md",
		rounded: "rounded-xl",
	}[shape];

	const content = (
		<>
			<span
				className={cn(
					"flex items-center justify-center bg-cp-accent text-[var(--cp-accent-ink)]",
					sizeClass,
					shapeClass,
				)}
			>
				<Hammer
					size={iconSize}
					strokeWidth={3}
					className="inline-block shrink-0 align-middle"
					aria-hidden="true"
				/>
			</span>
			{wordmark && (
				<span className="font-display font-semibold tracking-tight text-ink text-[15px]">
					{label}
				</span>
			)}
		</>
	);

	if (href) {
		return (
			<Link
				to={href}
				className={cn("flex items-center gap-2", className)}
				aria-label={ariaLabel}
			>
				{content}
			</Link>
		);
	}
	return (
		<span className={cn("flex items-center gap-2", className)}>{content}</span>
	);
}
