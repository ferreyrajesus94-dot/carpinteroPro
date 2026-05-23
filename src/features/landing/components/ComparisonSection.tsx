import { Check, X } from "lucide-react";
import type { ComparisonRow } from "../data/landingContent";

interface ComparisonSectionProps {
	tools: string[];
	rows: ComparisonRow[];
}

export function ComparisonSection({ tools, rows }: ComparisonSectionProps) {
	return (
		<section className="scroll-mt-20 py-16 sm:py-20">
			<div className="mx-auto max-w-6xl px-6 sm:px-8">
				<div className="mb-10 text-center">
					<p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink3">
						Comparativa
					</p>
					<h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
						¿Por qué no seguir con lo que ya tengo?
					</h2>
					<p className="mx-auto mt-3 max-w-2xl text-sm text-ink2">
						Mirá la diferencia real entre CarpinteroPro y las herramientas que
						usás hoy.
					</p>
				</div>
				<div className="landing-comparison-wrap">
					<table className="landing-comparison-table">
						<thead>
							<tr>
								<th scope="col">
									<span className="sr-only">Criterio</span>
								</th>
								{tools.map((t, i) => (
									<th
										key={t}
										scope="col"
										className={i === 0 ? "landing-comparison-highlight" : ""}
									>
										{i === 0 && (
											<span className="landing-comparison-badge">
												Recomendado
											</span>
										)}
										{t}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => (
								<tr key={r.name}>
									<th scope="row" className="landing-comparison-feature">
										{r.name}
									</th>
									{r.vals.map((v, vi) => (
										<td
											key={vi}
											className={vi === 0 ? "landing-comparison-highlight" : ""}
										>
											{v === true ? (
												<Check
													className="landing-comparison-yes"
													aria-label="Sí"
												/>
											) : v === false ? (
												<X className="landing-comparison-no" aria-label="No" />
											) : (
												<span className="landing-comparison-partial">{v}</span>
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</section>
	);
}
