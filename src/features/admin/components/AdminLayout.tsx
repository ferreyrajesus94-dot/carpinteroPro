import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/shared/lib/utils";
import { ADMIN_NAV_ITEMS } from "../lib/adminNavigation";

export function AdminLayout() {
	return (
		<div className="flex min-h-screen bg-background">
			<aside className="hidden w-64 flex-col border-r border-line bg-cp-surface lg:flex">
				<div className="border-b border-line px-4 py-4">
					<p className="font-mono text-[11px] uppercase tracking-wider text-ink3">
						Plataforma
					</p>
					<h1 className="mt-1 font-display text-lg font-semibold tracking-tight text-ink">
						Admin CarpinteroPro
					</h1>
				</div>
				<nav aria-label="Navegación de administración" className="flex-1 p-2">
					{ADMIN_NAV_ITEMS.map(({ to, label, icon }) => (
						<NavLink
							key={to}
							to={to}
							end={to === "/admin"}
							className={({ isActive }) =>
								cn(
									"flex h-10 items-center gap-3 rounded-md px-3 text-[13.5px] font-medium transition-colors",
									isActive
										? "bg-cp-accent-soft text-cp-accent"
										: "text-ink2 hover:bg-cp-bg2 hover:text-ink",
								)
							}
						>
							<i
								className={`fi ${icon} text-base leading-none`}
								aria-hidden="true"
							/>
							{label}
						</NavLink>
					))}
				</nav>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col">
				<header className="border-b border-line bg-cp-surface/90 px-4 py-3 backdrop-blur lg:hidden">
					<h1 className="font-display text-base font-semibold text-ink">
						Admin CarpinteroPro
					</h1>
					<nav
						aria-label="Navegación de administración móvil"
						className="mt-3 flex gap-2 overflow-x-auto pb-1"
					>
						{ADMIN_NAV_ITEMS.map(({ to, label }) => (
							<NavLink
								key={to}
								to={to}
								end={to === "/admin"}
								className={({ isActive }) =>
									cn(
										"rounded-full border border-line px-3 py-1.5 text-xs font-medium",
										isActive
											? "bg-cp-accent text-[var(--cp-accent-ink)]"
											: "text-ink2",
									)
								}
							>
								{label}
							</NavLink>
						))}
					</nav>
				</header>

				<main className="flex-1 overflow-y-auto p-4 lg:p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
}

export function AdminPlaceholderPage() {
	return (
		<section className="rounded-xl border border-line bg-cp-surface p-6 shadow-sm">
			<p className="font-mono text-xs uppercase tracking-wider text-ink3">
				Dashboard interno
			</p>
			<h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
				Panel de administrador
			</h2>
			<p className="mt-3 max-w-2xl text-sm leading-6 text-ink2">
				La estructura segura de administración ya está lista. Las métricas,
				talleres, billing y soporte se conectan en los próximos work units.
			</p>
		</section>
	);
}
