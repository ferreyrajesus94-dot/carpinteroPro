import { LandingHeader } from "./LandingHeader";
import { LandingHero } from "./LandingHero";
import { heroCopy, loginCta, navItems } from "../data/landingContent";

export function LandingPage() {
	return (
		<div className="landing-page min-h-screen bg-background text-foreground">
			<LandingHeader navItems={navItems} primaryCta={loginCta} />
			<main>
				<LandingHero copy={heroCopy} />
			</main>
		</div>
	);
}
