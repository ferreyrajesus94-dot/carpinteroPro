interface LandingSectionProps {
	id?: string;
	ariaLabel?: string;
	children: React.ReactNode;
	variant?: "default" | "alt";
}

export function LandingSection({
	id,
	ariaLabel,
	children,
	variant = "default",
}: LandingSectionProps) {
	return (
		<section
			id={id}
			aria-label={ariaLabel}
			className={`py-16 md:py-24 ${variant === "alt" ? "bg-cp-bg2" : "bg-background"}`}
		>
			<div className="mx-auto max-w-6xl px-6 sm:px-8">{children}</div>
		</section>
	);
}
