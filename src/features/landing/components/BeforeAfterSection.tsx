import { X, Check } from "lucide-react";
import type { BeforeAfterItem } from "../data/landingContent";
import { Eyebrow } from "@/shared/ui/eyebrow";

interface BeforeAfterSectionProps {
	beforeItems: BeforeAfterItem[];
	afterItems: BeforeAfterItem[];
}

export function BeforeAfterSection({
	beforeItems,
	afterItems,
}: BeforeAfterSectionProps) {
	return (
		<section className="scroll-mt-20 border-y border-line bg-cp-bg2 py-16 sm:py-20">
			<div className="mx-auto max-w-6xl px-6 sm:px-8">
				<div className="mb-10 text-center">
					<Eyebrow as="p" className="mb-2">El cambio</Eyebrow>
					<h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
						Antes vs. Después de CarpinteroPro
					</h2>
				</div>
				<div className="landing-before-after-grid">
					<div className="landing-before-after-card landing-before-card">
						<div className="mb-4 inline-block rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
							Antes
						</div>
						<div className="landing-chaos-visual" aria-hidden="true">
							<div className="landing-notebook-card">
								<b>$???</b>
								<span>Melamina + bisagras + mano de obra</span>
							</div>
							<div className="landing-chat-card">
								Cliente: ¿Y si lo hacemos 20cm más ancho?
							</div>
							<div className="landing-paper-card">Recalcular todo 😵‍💫</div>
						</div>
						<ul className="space-y-3">
							{beforeItems.map((item, i) => (
								<li
									key={i}
									className="flex items-start gap-3 text-sm text-ink2"
								>
									<X
										className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
										aria-hidden="true"
									/>
									{item.text}
								</li>
							))}
						</ul>
					</div>
					<div className="landing-before-after-arrow" aria-hidden="true">
						→
					</div>
					<div className="landing-before-after-card landing-after-card">
						<div className="mb-4 inline-block rounded-full bg-cp-accent/10 px-3 py-1 text-xs font-semibold text-cp-accent">
							Después
						</div>
						<div className="landing-app-preview" aria-hidden="true">
							<div>
								<span>Presupuesto #0042</span>
								<strong>$127.800</strong>
							</div>
							<div>
								<span>Materiales</span>
								<strong>Calculados</strong>
							</div>
							<div className="landing-wa-preview">Enviar por WhatsApp</div>
						</div>
						<ul className="space-y-3">
							{afterItems.map((item, i) => (
								<li key={i} className="flex items-start gap-3 text-sm text-ink">
									<Check
										className="mt-0.5 h-4 w-4 shrink-0 text-cp-accent"
										aria-hidden="true"
									/>
									{item.text}
								</li>
							))}
						</ul>
					</div>
				</div>
			</div>
		</section>
	);
}
