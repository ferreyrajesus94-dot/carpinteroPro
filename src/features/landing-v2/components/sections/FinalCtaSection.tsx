import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/ui/button";

export function FinalCtaSection() {
	return (
		<section id="cta" aria-labelledby="cta-title" className="bg-cp-bg">
			<div className="mx-auto max-w-3xl px-6 py-24 text-center sm:px-8 sm:py-32">
				<h2
					id="cta-title"
					className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
				>
					Dejá el cuaderno y empezá a usarlo hoy.
				</h2>
				<p className="mt-4 text-base leading-relaxed text-ink2 sm:text-lg">
					Gratis, en español, y pensado para un carpintero solo que labura desde el
					celular. Sin tarjeta de crédito ni letra chica.
				</p>

				<div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
					<Button asChild size="lg">
						<Link to="/login" className="gap-2">
							Crear cuenta gratis
							<ArrowRight aria-hidden="true" />
						</Link>
					</Button>
					<Button asChild variant="outline" size="lg">
						<Link to="/login">Ya tengo cuenta</Link>
					</Button>
				</div>
			</div>
		</section>
	);
}
