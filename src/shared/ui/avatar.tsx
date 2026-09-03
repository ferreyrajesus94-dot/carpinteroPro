import { cn } from "@/shared/lib/utils";

export type AvatarSize = "xs" | "sm" | "md" | "lg";
export type AvatarTone = "solid" | "soft";

interface AvatarProps {
	name?: string;
	email?: string;
	size?: AvatarSize;
	tone?: AvatarTone;
	className?: string;
}

export function getInitials(name?: string, email?: string, max = 2): string {
	if (name && name.trim()) {
		const parts = name.trim().split(/\s+/);
		return parts
			.map((w) => w[0] ?? "")
			.filter(Boolean)
			.slice(0, max)
			.join("")
			.toUpperCase();
	}
	if (email && email.trim()) {
		return email.trim().slice(0, max).toUpperCase();
	}
	return "?";
}

export function Avatar({
	name,
	email,
	size = "sm",
	tone = "solid",
	className,
}: AvatarProps) {
	const initials = getInitials(name, email);
	const sizeClass = {
		xs: "h-6 w-6 text-[10px]",
		sm: "h-8 w-8 text-[11px]",
		md: "h-11 w-11 text-[13px]",
		lg: "h-14 w-14 text-xl",
	}[size];
	const toneClass = {
		solid: "bg-cp-accent text-[var(--cp-accent-ink)]",
		soft: "bg-cp-accent-soft text-cp-accent",
	}[tone];

	return (
		<span
			className={cn(
				"inline-grid place-items-center rounded-full font-mono font-semibold shrink-0",
				sizeClass,
				toneClass,
				className,
			)}
			aria-hidden="true"
		>
			{initials}
		</span>
	);
}
