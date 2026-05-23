import { ArrowRight } from "lucide-react";
import type { WorkflowStep } from "../data/landingContent";

interface WorkflowSectionProps {
	steps: WorkflowStep[];
}

export function WorkflowSection({ steps }: WorkflowSectionProps) {
	return (
		<div className="grid gap-8 md:grid-cols-3">
			{steps.map((step, index) => (
				<div key={step.num} className="relative">
					<div className="mb-4 flex items-center gap-4">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-cp-accent text-[var(--cp-accent-ink)] font-mono text-sm font-semibold">
							{step.num}
						</div>
						{index < steps.length - 1 && (
							<div className="hidden md:flex flex-1 items-center">
								<ArrowRight className="h-4 w-4 text-ink3" aria-hidden="true" />
							</div>
						)}
					</div>
					<h3 className="mb-2 text-lg font-semibold text-ink">{step.title}</h3>
					<p className="text-sm leading-relaxed text-ink2">
						{step.description}
					</p>
				</div>
			))}
		</div>
	);
}
