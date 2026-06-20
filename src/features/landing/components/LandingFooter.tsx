import { Link } from "react-router-dom";
import type { FooterColumn } from "../data/landingContent";

interface LandingFooterProps {
	columns: FooterColumn[];
}

export function LandingFooter({ columns }: LandingFooterProps) {
	return (
		<footer className="border-t border-line bg-cp-bg2">
			<div className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
				<div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cp-accent text-[var(--cp-accent-ink)]">
								<i className="fi fi-br-hammer text-base leading-none" aria-hidden="true" />
							</span>
							<span className="font-display text-lg font-semibold tracking-tight text-ink">
								CarpinteroPro
							</span>
						</div>
						<p className="text-sm text-ink2">
							La app de gestión para carpinteros profesionales.
						</p>
					</div>

					{columns.map((col) => (
						<div key={col.title}>
							<h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink">
								{col.title}
							</h3>
							<ul className="space-y-2">
								{col.links.map((link) => {
									const isInternal = link.href.startsWith("/");
									return (
										<li key={link.href + link.label}>
											{isInternal ? (
												<Link
													to={link.href}
													className="text-sm text-ink2 transition-colors hover:text-ink"
												>
													{link.label}
												</Link>
											) : (
												<a
													href={link.href}
													className="text-sm text-ink2 transition-colors hover:text-ink"
												>
													{link.label}
												</a>
											)}
										</li>
									);
								})}
							</ul>
						</div>
					))}
				</div>

				<div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 sm:flex-row">
					<p className="text-xs text-ink3">
						© {new Date().getFullYear()} CarpinteroPro. Todos los derechos
						reservados.
					</p>
					<div className="flex gap-4">
						<Link
							to="/terms"
							className="text-xs text-ink3 transition-colors hover:text-ink2"
						>
							Términos
						</Link>
						<Link
							to="/privacy"
							className="text-xs text-ink3 transition-colors hover:text-ink2"
						>
							Privacidad
						</Link>
					</div>
				</div>
			</div>
		</footer>
	);
}
