import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import type { NavItem, LandingCta } from "../data/landingContent";

interface LandingHeaderProps {
	navItems: NavItem[];
	primaryCta: LandingCta;
}

export function LandingHeader({ navItems, primaryCta }: LandingHeaderProps) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 20);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<header
			className={`fixed top-0 left-0 right-0 z-50 transition-colors ${
				scrolled
					? "bg-background/90 backdrop-blur shadow-sm border-b border-line"
					: "bg-transparent"
			}`}
		>
			<div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-8">
				<Link
					to="/"
					className="flex items-center gap-2"
					aria-label="CarpinteroPro inicio"
				>
					<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cp-accent text-[var(--cp-accent-ink)]">
						<Zap className="h-5 w-5" aria-hidden="true" />
					</span>
					<span className="font-display text-lg font-semibold tracking-tight text-ink">
						CarpinteroPro
					</span>
				</Link>

				{/* Desktop nav */}
				<nav
					aria-label="Navegación de venta"
					className="hidden items-center gap-1 md:flex"
				>
					{navItems.map((item) => (
						<a
							key={item.href}
							href={item.href}
							className="rounded-md px-3 py-2 text-sm font-medium text-ink2 transition-colors hover:bg-cp-bg2 hover:text-ink"
						>
							{item.label}
						</a>
					))}
					<Link
						to={primaryCta.href}
						className="ml-3 inline-flex h-10 items-center justify-center rounded-md bg-cp-accent px-4 text-sm font-semibold text-[var(--cp-accent-ink)] shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99]"
					>
						{primaryCta.label}
					</Link>
				</nav>

				{/* Mobile toggle */}
				<button
					type="button"
					onClick={() => setMobileMenuOpen((prev) => !prev)}
					aria-expanded={mobileMenuOpen}
					aria-label="Abrir menú"
					className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink2 hover:bg-cp-bg2 md:hidden"
				>
					{mobileMenuOpen ? (
						<svg
							width="24"
							height="24"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
						</svg>
					) : (
						<svg
							width="24"
							height="24"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
						</svg>
					)}
				</button>
			</div>

			{/* Mobile menu */}
			{mobileMenuOpen && (
				<div className="border-t border-line bg-background px-6 py-4 md:hidden">
					{navItems.map((item) => (
						<a
							key={item.href}
							href={item.href}
							onClick={() => setMobileMenuOpen(false)}
							className="flex h-11 items-center text-sm font-medium text-ink2 transition-colors hover:text-ink"
						>
							{item.label}
						</a>
					))}
					<div className="mt-3 flex flex-col gap-2">
						<Link
							to={primaryCta.href}
							onClick={() => setMobileMenuOpen(false)}
							className="inline-flex h-11 items-center justify-center rounded-md bg-cp-accent px-4 text-sm font-semibold text-[var(--cp-accent-ink)] shadow-sm"
						>
							{primaryCta.label}
						</Link>
					</div>
				</div>
			)}
		</header>
	);
}
