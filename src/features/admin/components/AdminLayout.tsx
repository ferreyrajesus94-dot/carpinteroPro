import { NavLink, Outlet, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/lib/utils";
import { useTheme } from "@/shared/hooks/useTheme";
import { useAdminOverview } from "../hooks/useAdminOverview";
import { ADMIN_NAV_ITEMS } from "../lib/adminNavigation";

export function AdminLayout() {
	const { theme, toggle } = useTheme();
	const overview = useAdminOverview();
	const queryClient = useQueryClient();
	const webhookFailures = overview.data?.support?.recentWebhookFailures ?? 0;

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
							{to === "/admin" && webhookFailures > 0 && (
								<span className="ml-auto rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 leading-none">
									{webhookFailures}
								</span>
							)}
						</NavLink>
					))}
				</nav>

				<div className="border-t border-line p-3 space-y-2">
					<Link
						to="/dashboard"
						className="flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-medium text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors"
					>
						<i
							className="fi fi-rr-arrow-left text-sm leading-none"
							aria-hidden="true"
						/>
						Volver a la app
					</Link>
					<button
						type="button"
						onClick={toggle}
						aria-label={
							theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"
						}
						className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-[13px] font-medium text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors"
					>
						<i
							className={`fi ${theme === "dark" ? "fi-rr-sun" : "fi-rr-moon"} text-sm leading-none`}
							aria-hidden="true"
						/>
						{theme === "dark" ? "Modo claro" : "Modo oscuro"}
					</button>
				</div>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col">
				<a
					href="#main"
					className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-cp-accent focus:px-4 focus:py-2 focus:text-[var(--cp-accent-ink)] focus:shadow-lg"
				>
					Saltar al contenido
				</a>
				<header className="flex items-center justify-between border-b border-line bg-cp-surface/90 px-4 py-3 backdrop-blur">
					<div>
						<h1 className="font-display text-base font-semibold text-ink">
							Admin CarpinteroPro
						</h1>
						<nav
							aria-label="Navegación de administración móvil"
							className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden"
						>
							{ADMIN_NAV_ITEMS.map(({ to, label }) => (
								<NavLink
									key={to}
									to={to}
									end={to === "/admin"}
									className={({ isActive }) =>
										cn(
											"inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium",
											isActive
												? "bg-cp-accent text-[var(--cp-accent-ink)]"
												: "text-ink2",
										)
									}
								>
									{label}
									{to === "/admin" && webhookFailures > 0 && (
										<span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 leading-none">
											{webhookFailures}
										</span>
									)}
								</NavLink>
							))}
						</nav>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => queryClient.invalidateQueries()}
							aria-label="Actualizar datos"
							className="grid h-9 w-9 place-items-center rounded-md text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors"
						>
							<i
								className="fi fi-rr-refresh text-base leading-none"
								aria-hidden="true"
							/>
						</button>
						<Link
							to="/dashboard"
							aria-label="Volver a la app"
							className="grid h-9 w-9 place-items-center rounded-md text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors"
						>
							<i
								className="fi fi-rr-arrow-left text-base leading-none"
								aria-hidden="true"
							/>
						</Link>
						<button
							type="button"
							onClick={toggle}
							aria-label={
								theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"
							}
							className="grid h-9 w-9 place-items-center rounded-md text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors"
						>
							<i
								className={`fi ${theme === "dark" ? "fi-rr-sun" : "fi-rr-moon"} text-base leading-none`}
								aria-hidden="true"
							/>
						</button>
					</div>
				</header>

				<main id="main" className="flex-1 overflow-y-auto p-4 lg:p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
