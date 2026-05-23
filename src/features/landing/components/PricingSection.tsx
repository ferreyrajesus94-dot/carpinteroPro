import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import type { PricingPlan } from "../data/pricing";

interface PricingSectionProps {
	plan: PricingPlan;
}

export function PricingSection({ plan }: PricingSectionProps) {
	return (
		<div className="mx-auto max-w-md">
			<div className="rounded-2xl border border-line bg-cp-surface p-8 shadow-sm">
				<div className="mb-6 text-center">
					<div className="mb-2 text-sm font-medium text-ink2">{plan.name}</div>
					<div className="flex items-baseline justify-center gap-1">
						<span className="text-sm text-ink2">{plan.currency}</span>
						<span className="text-5xl font-bold tracking-tight text-ink">
							{plan.price}
						</span>
						<span className="text-sm text-ink2">{plan.cadence}</span>
					</div>
					<p className="mt-2 text-sm text-ink2">{plan.description}</p>
				</div>

				<ul className="mb-8 space-y-3">
					{plan.features.map((feature) => (
						<li
							key={feature}
							className="flex items-start gap-3 text-sm text-ink2"
						>
							<Check
								className="mt-0.5 h-4 w-4 shrink-0 text-cp-accent"
								aria-hidden="true"
							/>
							{feature}
						</li>
					))}
				</ul>

				<Link
					to={plan.ctaHref}
					className="flex h-12 items-center justify-center gap-2 rounded-md bg-cp-accent px-6 text-sm font-semibold text-[var(--cp-accent-ink)] shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99]"
				>
					{plan.ctaLabel}
				</Link>
			</div>
		</div>
	);
}
