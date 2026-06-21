import type { ReactNode } from "react";
import { createElement } from "react";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PAGE_HEADER_LEVEL = {
	H1: "h1",
	H2: "h2",
	H3: "h3",
} as const;

type PageHeaderLevel = (typeof PAGE_HEADER_LEVEL)[keyof typeof PAGE_HEADER_LEVEL];

export type { PageHeaderLevel };

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
		<div className="flex flex-col gap-1 pb-4">
			{eyebrow && (
				<span className="text-xs font-medium uppercase tracking-wider text-ink3">
					{eyebrow}
				</span>
			)}
			<div className="flex items-start justify-between gap-4">
				<div className="flex flex-col">
					{createElement(
						level,
						{
							className:
								"font-display text-2xl font-semibold tracking-tight text-ink",
						},
						title,
					)}
					{subtitle && (
						<p className="mt-0.5 text-sm text-ink2">{subtitle}</p>
					)}
				</div>
				{actions && (
					<div className="flex shrink-0 items-center gap-2">{actions}</div>
				)}
			</div>
		</div>
	);
}
