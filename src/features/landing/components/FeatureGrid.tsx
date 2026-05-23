import {
	Package,
	Armchair,
	FileText,
	Users,
	BarChart3,
	MessageCircle,
} from "lucide-react";
import type { FeatureItem } from "../data/landingContent";

const iconMap: Record<string, React.ReactNode> = {
	box: <Package className="h-6 w-6" aria-hidden="true" />,
	couch: <Armchair className="h-6 w-6" aria-hidden="true" />,
	fileText: <FileText className="h-6 w-6" aria-hidden="true" />,
	users: <Users className="h-6 w-6" aria-hidden="true" />,
	chart: <BarChart3 className="h-6 w-6" aria-hidden="true" />,
	messageCircle: <MessageCircle className="h-6 w-6" aria-hidden="true" />,
};

interface FeatureGridProps {
	features: FeatureItem[];
}

export function FeatureGrid({ features }: FeatureGridProps) {
	return (
		<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{features.map((feature) => (
				<div
					key={feature.title}
					className="rounded-xl border border-line bg-cp-surface p-6 transition-colors hover:border-cp-accent/30"
				>
					<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cp-accent-soft text-cp-accent">
						{iconMap[feature.icon]}
					</div>
					<h3 className="mb-2 text-base font-semibold text-ink">
						{feature.title}
					</h3>
					<p className="text-sm leading-relaxed text-ink2">
						{feature.description}
					</p>
				</div>
			))}
		</div>
	);
}
