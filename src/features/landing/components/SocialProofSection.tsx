import type { Testimonial } from "../data/landingContent";

interface SocialProofSectionProps {
	testimonials: Testimonial[];
}

export function SocialProofSection({ testimonials }: SocialProofSectionProps) {
	return (
		<section
			id="testimonials"
			className="scroll-mt-20 border-y border-line bg-cp-bg2 py-16 sm:py-20"
		>
			<div className="mx-auto max-w-6xl px-6 sm:px-8">
				<div className="mb-10 text-center">
					<p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink3">
						Diseñado para tu día a día
					</p>
					<h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
						Lo que CarpinteroPro ordena en tu taller
					</h2>
				</div>
				<div className="grid gap-6 md:grid-cols-3">
					{testimonials.map((t) => (
						<div
							key={t.name}
							className="rounded-2xl border border-line bg-cp-surface p-6 shadow-sm transition-transform hover:-translate-y-1"
						>
							<div
								className="mb-3 text-base tracking-wider text-cp-accent"
								aria-label="Beneficio destacado"
							>
								<span aria-hidden="true">{"★".repeat(5)}</span>
							</div>
							<blockquote className="mb-4 text-sm leading-relaxed text-ink2 italic">
								"{t.quote}"
							</blockquote>
							<div className="flex items-center gap-3">
								<div className="flex h-9 w-9 items-center justify-center rounded-full bg-cp-accent-soft font-semibold text-cp-accent">
									{t.name[0]}
								</div>
								<div>
									<p className="text-sm font-semibold text-ink">{t.name}</p>
									<p className="text-xs text-ink3">{t.role}</p>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
