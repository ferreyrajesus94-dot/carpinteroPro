import { FinalCtaSection, HeroSection, PainSection } from "./sections";

export function LandingV2Page() {
	return (
		<main className="min-h-screen bg-cp-bg text-ink">
			<HeroSection />
			<PainSection />
			<FinalCtaSection />
		</main>
	);
}
