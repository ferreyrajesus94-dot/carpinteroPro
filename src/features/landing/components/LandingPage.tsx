import { LandingHeader } from "./LandingHeader";
import { LandingHero } from "./LandingHero";
import { LandingSection } from "./LandingSection";
import { FeatureGrid } from "./FeatureGrid";
import { WorkflowSection } from "./WorkflowSection";
import {
	features,
	heroCopy,
	loginCta,
	navItems,
	workflowSteps,
} from "../data/landingContent";

export function LandingPage() {
	return (
		<div className="landing-page min-h-screen bg-background text-foreground">
			<LandingHeader navItems={navItems} primaryCta={loginCta} />
			<main>
				<LandingHero copy={heroCopy} />

				<LandingSection id="features" aria-label="Funciones">
					<div className="mb-12 text-center">
						<span className="mb-3 inline-block rounded-full border border-line bg-cp-surface px-3 py-1 text-xs font-medium text-ink2">
							Funciones
						</span>
						<h2 className="mb-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
							Todo lo que necesitás para gestionar tu taller
						</h2>
						<p className="mx-auto max-w-2xl text-base text-ink2">
							Dejá de usar cuadernos, Excel y WhatsApp suelto. Una sola app
							para todo.
						</p>
					</div>
					<FeatureGrid features={features} />
				</LandingSection>

				<LandingSection id="workflow" aria-label="Cómo funciona" variant="alt">
					<div className="mb-12 text-center">
						<span className="mb-3 inline-block rounded-full border border-line bg-cp-surface px-3 py-1 text-xs font-medium text-ink2">
							Cómo funciona
						</span>
						<h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
							De la idea al presupuesto en 3 pasos
						</h2>
					</div>
					<WorkflowSection steps={workflowSteps} />
				</LandingSection>
			</main>
		</div>
	);
}
