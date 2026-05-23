import { LandingHeader } from "./LandingHeader";
import { LandingHero } from "./LandingHero";
import { LandingFooter } from "./LandingFooter";
import { LandingSection } from "./LandingSection";
import { FeatureGrid } from "./FeatureGrid";
import { WorkflowSection } from "./WorkflowSection";
import { PricingSection } from "./PricingSection";
import { FaqSection } from "./FaqSection";
import { SocialProofSection } from "./SocialProofSection";
import { PainPointsSection } from "./PainPointsSection";
import { BeforeAfterSection } from "./BeforeAfterSection";
import { ComparisonSection } from "./ComparisonSection";
import { ROICalculatorSection } from "./ROICalculatorSection";
import "./landing-visual-demos.css";
import {
	afterItems,
	beforeItems,
	comparisonRows,
	comparisonTools,
	faqs,
	features,
	footerColumns,
	heroCopy,
	loginCta,
	navItems,
	painPoints,
	testimonials,
	workflowSteps,
} from "../data/landingContent";
import { pricingPlan } from "../data/pricing";

export function LandingPage() {
	return (
		<div className="landing-page min-h-screen bg-background text-foreground">
			<LandingHeader navItems={navItems} primaryCta={loginCta} />
			<main>
				<LandingHero copy={heroCopy} />

				<SocialProofSection testimonials={testimonials} />

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

				<PainPointsSection pains={painPoints} />

				<BeforeAfterSection beforeItems={beforeItems} afterItems={afterItems} />

				<ComparisonSection tools={comparisonTools} rows={comparisonRows} />

				<ROICalculatorSection />

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

				<LandingSection id="pricing" aria-label="Precios" variant="alt">
					<div className="mb-12 text-center">
						<span className="mb-3 inline-block rounded-full border border-line bg-cp-surface px-3 py-1 text-xs font-medium text-ink2">
							Precio simple
						</span>
						<h2 className="mb-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
							Una suscripción, todo incluido
						</h2>
						<p className="mx-auto max-w-2xl text-base text-ink2">
							Sin sorpresas. Sin funciones bloqueadas. Todo desde el día uno.
						</p>
					</div>
					<PricingSection plan={pricingPlan} />
				</LandingSection>

				<LandingSection id="faq" aria-label="Preguntas frecuentes">
					<div className="mb-12 text-center">
						<span className="mb-3 inline-block rounded-full border border-line bg-cp-surface px-3 py-1 text-xs font-medium text-ink2">
							Preguntas frecuentes
						</span>
						<h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
							¿Tenés dudas?
						</h2>
					</div>
					<FaqSection faqs={faqs} />
				</LandingSection>
			</main>
			<LandingFooter columns={footerColumns} />
		</div>
	);
}
