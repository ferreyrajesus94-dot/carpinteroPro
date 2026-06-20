import type { ReactNode } from "react";

export interface PageHeaderProps {
	eyebrow?: string;
	title: string;
	subtitle?: string;
	actions?: ReactNode;
}

export function PageHeader({
	eyebrow,
	title,
	subtitle,
	actions,
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
					<h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
						{title}
					</h1>
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
