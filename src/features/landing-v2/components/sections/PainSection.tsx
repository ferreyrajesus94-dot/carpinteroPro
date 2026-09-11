import { Calculator, NotebookPen, PackageSearch } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Eyebrow } from "@/shared/ui/eyebrow";

interface PainItem {
	title: string;
	description: string;
	Icon: LucideIcon;
}

const PAINS: readonly PainItem[] = [
	{
		title: "El cuaderno se pierde",
		description:
			"Anotás medidas y materiales en un papel que después no aparece, y volvés a medir desde cero.",
		Icon: NotebookPen,
	},
	{
		title: "El precio lo cambiás mil veces",
		description:
			"Sumás madera, horas y flete a ojo, y nunca terminás de confiar en el número que le pasaste al cliente.",
		Icon: Calculator,
	},
	{
		title: "No sabés qué tenés en stock",
		description:
			"Comprás lo que ya tenías en el depósito porque no hay un registro claro de qué quedó y qué se usó.",
		Icon: PackageSearch,
	},
];

export function PainSection() {
	return (
		<section id="pain" aria-labelledby="pain-title" className="bg-cp-bg2">
			<div className="mx-auto max-w-6xl px-6 py-20 sm:px-8 sm:py-28">
				<div className="mb-12 max-w-2xl">
					<Eyebrow as="p" variant="mono" tone="muted" className="mb-4">
						¿Te suena familiar?
					</Eyebrow>
					<h2
						id="pain-title"
						className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
					>
						Tres problemas que todo carpintero solo conoce.
					</h2>
				</div>

				<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{PAINS.map(({ title, description, Icon }) => (
						<li
							key={title}
							className="rounded-lg border border-line bg-cp-surface p-6 shadow-sm"
						>
							<Icon className="mb-4 h-6 w-6 text-cp-accent" aria-hidden="true" />
							<h3 className="mb-2 text-base font-semibold text-ink">{title}</h3>
							<p className="text-sm leading-relaxed text-ink2">{description}</p>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
