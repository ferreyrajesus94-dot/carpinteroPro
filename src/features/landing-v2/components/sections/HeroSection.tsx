import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Eyebrow } from "@/shared/ui/eyebrow";

export function HeroSection() {
	return (
		<section id="hero" aria-labelledby="hero-title" className="bg-cp-bg">
			<div className="mx-auto flex min-h-[80vh] max-w-6xl flex-col justify-center px-6 py-20 sm:px-8 sm:py-28">
				<Eyebrow as="p" variant="mono" tone="muted" className="mb-6">
					Para carpinteros que laburan solos
				</Eyebrow>

				<h1
					id="hero-title"
					className="font-display text-[clamp(1.75rem,5vw,3.5rem)] font-semibold leading-[1.1] tracking-tight text-ink"
				>
					Presupuestá, fabricá y cobrá sin perder el hilo.
				</h1>

				<p className="mt-6 max-w-2xl text-base leading-relaxed text-ink2 sm:text-lg">
					Una sola app para correr tu taller: stock, recetas, presupuestos y
					producción, en español y desde el celular.
				</p>

				<div className="mt-10 flex flex-col gap-3 sm:flex-row">
					<Button asChild size="lg">
						<Link to="/login" className="gap-2">
							Empezá gratis
							<ArrowRight aria-hidden="true" />
						</Link>
					</Button>
					<Button asChild variant="outline" size="lg">
						<a href="#pain">Ver cómo funciona</a>
					</Button>
				</div>
			</div>
		</section>
	);
}
