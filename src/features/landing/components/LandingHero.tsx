import { Link } from "react-router-dom";
import type { HeroCopy } from "../data/landingContent";

interface LandingHeroProps {
	copy: HeroCopy;
}

export function LandingHero({ copy }: LandingHeroProps) {
	return (
		<section className="relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-24">
			<div className="landing-hero-particles" aria-hidden="true">
				<span style={{ left: "8%", top: "18%", animationDelay: "0s" }} />
				<span style={{ left: "18%", top: "72%", animationDelay: "1.2s" }} />
				<span style={{ left: "62%", top: "12%", animationDelay: "0.6s" }} />
				<span style={{ left: "82%", top: "58%", animationDelay: "1.8s" }} />
				<span style={{ left: "45%", top: "86%", animationDelay: "2.4s" }} />
			</div>
			<div className="mx-auto max-w-6xl px-6 sm:px-8">
				<div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
					<div className="space-y-8">
						<p className="inline-flex items-center gap-2 rounded-full border border-line bg-cp-surface px-3 py-1 text-xs font-medium text-ink2 shadow-sm">
							<span
								className="flex h-2 w-2 rounded-full bg-cp-accent"
								aria-hidden="true"
							/>
							{copy.eyebrow}
						</p>
						<div className="space-y-5">
							<h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
								{copy.headline}
							</h1>
							<p className="max-w-xl text-base leading-7 text-ink2 sm:text-lg">
								{copy.description}
							</p>
						</div>
						<div className="flex flex-col gap-3 sm:flex-row">
							<Link
								to={copy.primaryCta.href}
								className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-cp-accent px-6 text-sm font-semibold text-[var(--cp-accent-ink)] shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99]"
							>
								{copy.primaryCta.label}
								<svg
									width="16"
									height="16"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth="2.5"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<path d="M5 12h14M12 5l7 7-7 7" />
								</svg>
							</Link>
							<a
								href={copy.secondaryCta.href}
								className="inline-flex h-12 items-center justify-center rounded-md border border-line bg-cp-surface px-6 text-sm font-semibold text-ink transition-colors hover:bg-cp-bg2"
							>
								{copy.secondaryCta.label}
							</a>
						</div>
						<p className="text-xs text-ink3">{copy.note}</p>
					</div>

					<div
						role="img"
						aria-label="Vista previa del panel del taller de CarpinteroPro"
						className="landing-hero-demo"
					>
						<div className="landing-hero-demo-toolbar">
							<div>
								<p>Vista previa</p>
								<strong>Panel del taller</strong>
							</div>
							<span>Pro</span>
						</div>
						<div className="landing-hero-kpis">
							<div>
								<span>Facturado</span>
								<strong>$1.284.000</strong>
								<div className="landing-animated-bar">
									<i style={{ width: "78%" }} />
								</div>
							</div>
							<div>
								<span>Presupuestos</span>
								<strong>24 activos</strong>
								<div className="landing-animated-bar">
									<i style={{ width: "62%" }} />
								</div>
							</div>
						</div>
						<div className="landing-hero-pipeline">
							{["Nuevo", "Enviado", "Aprobado"].map((label, index) => (
								<div key={label}>
									<span>{label}</span>
									<strong>{[8, 11, 5][index]}</strong>
								</div>
							))}
						</div>
						<div className="landing-hero-task-card">
							<span>Próximo envío</span>
							<strong>Bajo mesada · PDF + WhatsApp</strong>
							<div className="landing-animated-bar">
								<i style={{ width: "86%" }} />
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
