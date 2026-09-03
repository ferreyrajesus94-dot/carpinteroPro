import {
	Outlet,
	NavLink,
	Navigate,
	Link,
	useLocation,
	useNavigate,
} from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { cn } from "@/shared/lib/utils";
import { OfflineBanner } from "@/shared/components/OfflineBanner";
import { MaintenanceBanner } from "@/shared/components/MaintenanceBanner";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { Avatar } from "@/shared/ui/avatar";
import { Eyebrow } from "@/shared/ui/eyebrow";
import { useAuth, type ProfileIssue } from "@/shared/providers/AuthProvider";
import { getSupportMailtoHref } from "@/shared/lib/supportContact";
import { useSubscription } from "@/features/billing/hooks/useSubscription";
import { useCreateSubscription } from "@/features/billing/hooks/useBillingActions";
import { BillingGate } from "@/features/billing/components/BillingGate";
import { GlobalSearch } from "@/features/search";
import { NAV_ITEMS, type NavItem } from "./nav-items";
import { dispatchFab } from "@/shared/lib/fab";

function isWizardPath(pathname: string) {
	const segs = pathname.split("/").filter(Boolean);
	return segs[0] === "quotes" && segs.length === 2 && segs[1] !== "templates";
}

function activeNav(pathname: string): NavItem | undefined {
	return NAV_ITEMS.find(
		(n) => pathname === n.to || pathname.startsWith(n.to + "/"),
	);
}

export function AppLayout() {
	const auth = useAuth();

	if (
		auth.loading ||
		auth.status === "initializing" ||
		auth.status === "profile_loading"
	) {
		return (
			<div
				className="flex h-screen items-center justify-center"
				role="status"
				aria-label="Cargando sesión"
			>
				<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
			</div>
		);
	}
	if (auth.status === "unauthenticated" || !auth.session)
		return <Navigate to="/login" replace />;
	if (auth.status === "profile_error" || auth.status === "profile_missing") {
		return (
			<AuthProfileRecoveryScreen
				issue={auth.profileIssue}
				onRetry={auth.refreshProfile}
				onSignOut={auth.signOut}
			/>
		);
	}
	if (!auth.onboardedAt) return <Navigate to="/onboarding" replace />;

	return (
		<AuthenticatedAppShell
			session={auth.session}
			onboardedAt={auth.onboardedAt}
			workshopId={auth.workshopId}
			isPlatformAdmin={auth.isPlatformAdmin}
		/>
	);
}

interface AuthProfileRecoveryScreenProps {
	issue: ProfileIssue | null;
	onRetry: () => Promise<void>;
	onSignOut: () => Promise<void>;
}

function AuthProfileRecoveryScreen({
	issue,
	onRetry,
	onSignOut,
}: AuthProfileRecoveryScreenProps) {
	const title = issue?.title ?? "No pudimos cargar tu perfil de taller";
	const message =
		issue?.message ??
		"Hubo un problema al cargar la información de tu taller. Reintentá en unos segundos o cerrá sesión para volver a ingresar.";
	const profileSupportHref = getSupportMailtoHref({
		subject: "Problema con mi perfil de taller",
		body: "Necesito ayuda con un error al cargar mi perfil en CarpinteroPro.",
	});

	return (
		<main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
			<section className="w-full max-w-md rounded-xl border border-line bg-cp-surface p-6 text-center shadow-sm">
				<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cp-accent-soft text-cp-accent">
					<i
						className="fi fi-rr-triangle-warning text-xl leading-none"
						aria-hidden="true"
					/>
				</div>
				<h1 className="font-display text-xl font-semibold tracking-tight text-ink">
					{title}
				</h1>
				<p className="mt-3 text-sm leading-6 text-ink2">{message}</p>
				<p className="mt-3 text-xs leading-5 text-ink3">
					Si el problema continúa, contactá a soporte e indicá el email de tu
					cuenta.
				</p>
				{profileSupportHref ? (
					<p className="mt-2 text-xs leading-5 text-ink3">
						<a
							data-testid="profile-recovery-support-link"
							href={profileSupportHref}
							className="text-cp-accent underline hover:text-cp-accent-ink"
						>
							Escribir a soporte
						</a>
					</p>
				) : null}
				<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
					<button
						type="button"
						onClick={() => {
							void onRetry();
						}}
						className="inline-flex h-10 items-center justify-center rounded-md bg-cp-accent px-4 text-sm font-medium text-[var(--cp-accent-ink)] transition-opacity hover:opacity-90"
					>
						Reintentar
					</button>
					<button
						type="button"
						onClick={() => {
							void onSignOut();
						}}
						className="inline-flex h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-medium text-ink2 transition-colors hover:bg-cp-bg2 hover:text-ink"
					>
						Cerrar sesión
					</button>
				</div>
			</section>
		</main>
	);
}

interface AuthenticatedAppShellProps {
	session: Session;
	onboardedAt: string;
	workshopId: string | null;
	isPlatformAdmin: boolean;
}

function AuthenticatedAppShell({
	session,
	onboardedAt,
	workshopId,
	isPlatformAdmin,
}: AuthenticatedAppShellProps) {
	const { data: subscription, isLoading: subscriptionLoading } =
		useSubscription(workshopId, onboardedAt);
	const createSubscription = useCreateSubscription();
	const location = useLocation();
	const navigate = useNavigate();

	const userEmail = session?.user?.email ?? "";
	const workshopName = session?.user?.user_metadata?.workshop_name ?? "";
	const displayName = session?.user?.user_metadata?.full_name ?? "";

	const wizard = isWizardPath(location.pathname);
	const current = activeNav(location.pathname);
	const sectionTitle =
		current?.label ??
		(location.pathname.startsWith("/settings")
			? "Ajustes"
			: location.pathname.startsWith("/profile")
				? "Mi perfil"
				: "CarpinteroPro");

	async function handleStartPayment() {
		const result = await createSubscription.mutateAsync();
		if (result.initPoint) window.location.assign(result.initPoint);
	}

	function handleFab() {
		if (!current) return;
		if (current.fabHref) navigate(current.fabHref);
		else if (current.fabAction) dispatchFab(current.fabAction);
	}

	const shell = wizard ? (
		<div className="flex h-screen flex-col bg-background">
			<OfflineBanner />
			<MaintenanceBanner />
			<a
				href="#main"
				className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-cp-accent focus:px-4 focus:py-2 focus:text-[var(--cp-accent-ink)] focus:shadow-lg"
			>
				Saltar al contenido
			</a>
			<main id="main" className="flex-1 overflow-y-auto">
				<Outlet />
			</main>
		</div>
	) : (
		<div className="flex h-screen bg-background">
			{/* === SIDEBAR DESKTOP ≥1024 === */}
			<aside className="hidden lg:flex lg:w-60 lg:flex-col border-r border-line bg-cp-surface">
				<div className="flex h-14 items-center gap-2 px-4 border-b border-line">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-cp-accent">
						<i className="fi fi-br-hammer text-sm text-[var(--cp-accent-ink)]" />
					</div>
					<span className="font-display font-semibold text-[15px] tracking-tight text-ink">
						CarpinteroPro
					</span>
				</div>
				<nav
					aria-label="Navegación principal lateral"
					className="flex-1 overflow-y-auto p-2 space-y-0.5"
				>
					{NAV_ITEMS.map(({ to, label, icon }) => (
						<NavLink
							key={to}
							to={to}
							className={({ isActive }) =>
								cn(
									"flex items-center gap-3 rounded-md px-3 h-9 text-[13.5px] font-medium transition-colors focus-ring",
									isActive
										? "bg-cp-accent-soft text-cp-accent"
										: "text-ink2 hover:bg-cp-bg2 hover:text-ink",
								)
							}
						>
							<i className={`fi ${icon} text-base leading-none shrink-0`} />
							{label}
						</NavLink>
					))}
				</nav>
				<div className="border-t border-line p-2 space-y-0.5">
					{isPlatformAdmin && (
						<NavLink
							to="/admin"
							className={({ isActive }) =>
								cn(
									"flex items-center gap-3 rounded-md px-3 h-9 text-[13.5px] font-medium transition-colors focus-ring",
									isActive
										? "bg-cp-accent-soft text-cp-accent"
										: "text-ink2 hover:bg-cp-bg2 hover:text-ink",
								)
							}
						>
							<i className="fi fi-rr-shield-check text-base leading-none shrink-0" />
							Admin
						</NavLink>
					)}
					<NavLink
						to="/settings"
						className={({ isActive }) =>
							cn(
								"flex items-center gap-3 rounded-md px-3 h-9 text-[13.5px] font-medium transition-colors focus-ring",
								isActive
									? "bg-cp-accent-soft text-cp-accent"
									: "text-ink2 hover:bg-cp-bg2 hover:text-ink",
							)
						}
					>
						<i className="fi fi-rr-settings text-base leading-none shrink-0" />
						Ajustes
					</NavLink>
					<Link
						to="/profile"
						className="mt-1 flex items-center gap-2 rounded-md px-2 py-2 hover:bg-cp-bg2 transition-colors focus-ring"
					>
						<Avatar
							name={displayName}
							email={userEmail}
							size="sm"
							tone="solid"
						/>
						<div className="min-w-0">
							{workshopName && (
								<p className="truncate text-[12.5px] font-semibold text-ink">
									{workshopName}
								</p>
							)}
							{userEmail && (
								<p className="truncate text-[11px] text-ink3">{userEmail}</p>
							)}
						</div>
					</Link>
					<div className="flex gap-3 px-2 pt-1 pb-0.5">
						<Link
							to="/terms"
							target="_blank"
							className="text-[10.5px] text-ink3 hover:text-ink2 transition-colors"
						>
							Términos
						</Link>
						<Link
							to="/privacy"
							target="_blank"
							className="text-[10.5px] text-ink3 hover:text-ink2 transition-colors"
						>
							Privacidad
						</Link>
					</div>
				</div>
			</aside>

			{/* === COLUMNA PRINCIPAL === */}
			<div className="flex flex-1 flex-col overflow-hidden">
				<OfflineBanner />
				<MaintenanceBanner />

				{/* Topbar desktop */}
				<header className="hidden lg:flex h-14 items-center gap-3 px-6 border-b border-line bg-cp-surface/85 backdrop-blur sticky top-0 z-10">
					<Eyebrow variant="mono" className="flex items-center gap-1.5 text-[11px]">
						<span>CarpinteroPro</span>
						<i className="fi fi-rr-angle-small-right text-[10px]" />
						<span className="text-ink2">{sectionTitle}</span>
					</Eyebrow>
					<div className="flex-1" />
					<GlobalSearch />
					<ThemeToggle
						variant="icon"
						className="h-9 w-9"
					/>
				</header>

				{/* Header mobile */}
				<header className="flex h-12 items-center gap-2 px-4 border-b border-line bg-cp-surface/85 backdrop-blur lg:hidden sticky top-0 z-10">
					<div className="flex h-6 w-6 items-center justify-center rounded-md bg-cp-accent shrink-0">
						<i className="fi fi-br-hammer text-[11px] text-[var(--cp-accent-ink)]" />
					</div>
					<span className="font-display font-semibold text-[14px] tracking-tight text-ink truncate flex-1">
						{sectionTitle}
					</span>
					<NavLink
						to="/buscar"
						aria-label="Buscar"
						className={({ isActive }) =>
							cn(
								"grid h-11 w-11 place-items-center rounded-md transition-colors focus-ring",
								isActive
									? "bg-cp-accent-soft text-cp-accent"
									: "text-ink2 hover:bg-cp-bg2 hover:text-ink",
							)
						}
					>
						<i className="fi fi-rr-search text-base leading-none" />
					</NavLink>
					<ThemeToggle
						variant="icon"
						className="h-11 w-11"
					/>
					{isPlatformAdmin && (
						<NavLink
							to="/admin"
							aria-label="Admin"
							className={({ isActive }) =>
								cn(
									"grid h-11 w-11 place-items-center rounded-md transition-colors focus-ring",
									isActive
										? "bg-cp-accent-soft text-cp-accent"
										: "text-ink2 hover:bg-cp-bg2 hover:text-ink",
								)
							}
						>
							<i className="fi fi-rr-shield-check text-base leading-none" />
						</NavLink>
					)}
					<NavLink
						to="/settings"
						aria-label="Ajustes"
						className={({ isActive }) =>
							cn(
								"grid h-11 w-11 place-items-center rounded-md transition-colors focus-ring",
								isActive
									? "bg-cp-accent-soft text-cp-accent"
									: "text-ink2 hover:bg-cp-bg2 hover:text-ink",
							)
						}
					>
						<i className="fi fi-rr-settings text-base leading-none" />
					</NavLink>
					<Link
						to="/profile"
						aria-label="Mi perfil"
						className="grid h-11 w-11 place-items-center rounded-full bg-cp-accent text-[var(--cp-accent-ink)] font-mono text-[11px] font-semibold hover:opacity-90 transition-opacity focus-ring"
					>
						<Avatar
							name={displayName}
							email={userEmail}
							size="md"
							tone="solid"
						/>
					</Link>
				</header>

				<a
					href="#main"
					className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-cp-accent focus:px-4 focus:py-2 focus:text-[var(--cp-accent-ink)] focus:shadow-lg"
				>
					Saltar al contenido
				</a>
				<main id="main" className="flex-1 overflow-y-auto p-4 pb-24 lg:pb-4">
					<Outlet />
				</main>

				{/* FAB contextual mobile */}
				{current?.fabLabel && (
					<button
						type="button"
						onClick={handleFab}
						className="fixed left-1/2 z-30 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-cp-accent px-5 text-[14px] font-medium text-[var(--cp-accent-ink)] shadow-xl transition-transform hover:scale-[1.02] active:scale-95 lg:hidden focus-ring"
						style={{
							bottom: "calc(72px + env(safe-area-inset-bottom) + 14px)",
						}}
					>
						<i className="fi fi-rr-plus text-sm leading-none" />
						{current.fabLabel}
					</button>
				)}

				{/* Bottom tabs mobile */}
				<nav
					aria-label="Navegación principal inferior"
					className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-line bg-cp-surface/95 backdrop-blur lg:hidden"
					style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
				>
					{NAV_ITEMS.map(({ to, label, icon }) => (
						<NavLink
							key={to}
							to={to}
							className={({ isActive }) =>
								cn(
									"flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors focus-ring",
									isActive ? "text-ink" : "text-ink3 hover:text-ink2",
								)
							}
						>
							{({ isActive }) => (
								<>
									<i
										className={cn(
											`fi ${icon} text-lg leading-none`,
											isActive && "text-cp-accent",
										)}
									/>
									<span className={isActive ? "font-semibold" : "font-medium"}>
										{label}
									</span>
								</>
							)}
						</NavLink>
					))}
				</nav>
			</div>
		</div>
	);

	return (
		<BillingGate
			subscription={subscription ?? null}
			isLoading={subscriptionLoading}
			onStartPayment={handleStartPayment}
			isPaymentLoading={createSubscription.isPending}
		>
			{shell}
		</BillingGate>
	);
}
