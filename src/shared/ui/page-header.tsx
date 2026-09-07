import type { ReactNode } from "react";
import { createElement } from "react";
import { Eyebrow } from "./eyebrow";

export type PageHeaderLevel = "h1" | "h2" | "h3";

export interface PageHeaderProps {
	eyebrow?: string;
	title: string;
	subtitle?: string;
	actions?: ReactNode;
	level?: PageHeaderLevel;
}

export function PageHeader({
	eyebrow,
	title,
	subtitle,
	actions,
	level = "h1",
}: PageHeaderProps) {
	return (
		<div className="flex min-w-0 flex-col gap-1 pb-4">
			{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
			<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
				<div className="flex min-w-0 flex-col">
					{createElement(
						level,
						{
							// tracking-[-0.02em] replaces Tailwind's tracking-tight (-0.025em).
							// Fraunces carries more visual weight at large sizes than the
							// previous Space Grotesk, so a touch less tightening keeps
							// the optical balance without crowding the letterforms.
							className:
								"font-display text-2xl font-semibold tracking-[-0.02em] text-ink",
						},
						title,
					)}
					{subtitle && <p className="mt-0.5 text-sm text-ink2">{subtitle}</p>}
				</div>
				{actions && (
					<div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
						{actions}
					</div>
				)}
			</div>
		</div>
	);
}
