import { useState, useEffect } from "react";
import { Zap } from "lucide-react";
import type { PainPoint } from "../data/landingContent";

interface PainPointsSectionProps {
	pains: PainPoint[];
}

function getReducedMotion() {
	if (typeof window === "undefined" || !window.matchMedia) return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PainPointsSection({ pains }: PainPointsSectionProps) {
	const [activeIdx, setActiveIdx] = useState(() =>
		getReducedMotion() ? pains.length - 1 : -1,
	);

	useEffect(() => {
		if (getReducedMotion()) return;
		let i = 0;
		const interval = setInterval(() => {
			if (i < pains.length) {
				setActiveIdx(i);
				i++;
			} else {
				clearInterval(interval);
			}
		}, 600);
		return () => clearInterval(interval);
	}, [pains.length]);

	return (
		<section className="scroll-mt-20 py-16 sm:py-20">
			<div className="mx-auto max-w-6xl px-6 sm:px-8">
				<div className="mb-10 text-center">
					<p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink3">
						¿Te suena familiar?
					</p>
					<h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
						Los problemas que todo carpintero conoce
					</h2>
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{pains.map((p, i) => (
						<div
							key={i}
							className={`rounded-xl border p-5 transition-all ${
								activeIdx >= i
									? "border-line bg-cp-surface opacity-100"
									: "border-line/50 bg-cp-bg2 opacity-60"
							}`}
						>
							<p className="text-sm leading-relaxed text-ink2">{p.question}</p>
							{activeIdx >= i && (
								<p className="mt-3 text-xs font-medium text-cp-accent">
									← Sí, me pasa
								</p>
							)}
						</div>
					))}
				</div>
				<div className="mt-10 flex items-center gap-4 rounded-2xl border border-line bg-cp-surface p-6">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cp-accent-soft text-cp-accent">
						<Zap className="h-5 w-5" aria-hidden="true" />
					</div>
					<p className="text-sm leading-relaxed text-ink2">
						<strong className="text-ink">
							CarpinteroPro te ayuda a ordenar estos problemas.
						</strong>{" "}
						Y lo hace desde tu celular, con presupuestos más rápidos y
						consistentes.
					</p>
				</div>
			</div>
		</section>
	);
}
