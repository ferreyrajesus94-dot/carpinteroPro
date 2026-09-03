import { Link } from "react-router-dom";
import type { FooterColumn } from "../data/landingContent";
import { Eyebrow } from "@/shared/ui/eyebrow";
import { BrandMark } from "@/shared/ui/brand-mark";

interface LandingFooterProps {
	columns: FooterColumn[];
}

export function LandingFooter({ columns }: LandingFooterProps) {
	return (
		<footer className="border-t border-line bg-cp-bg2">
			<div className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
				<div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
					<div className="space-y-3">
						<BrandMark size="md" shape="rounded" />
						<p className="text-sm text-ink2">
							La app de gestión para carpinteros profesionales.
						</p>
					</div>

					{columns.map((col) => (
						<div key={col.title}>
							<Eyebrow
								as="h3"
								className="mb-3 text-sm font-semibold text-ink"
							>
								{col.title}
							</Eyebrow>
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
