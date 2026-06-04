import { createBrowserRouter } from "react-router-dom";

const hydrateFallbackElement = <div className="min-h-screen bg-background" />;

const errorElement = (
	<div className="flex h-screen flex-col items-center justify-center gap-4 p-8">
		<p className="text-lg font-medium text-destructive">
			Error al cargar la página
		</p>
		<button
			className="text-sm text-muted-foreground underline"
			onClick={() => window.location.reload()}
		>
			Recargar
		</button>
	</div>
);

export const router = createBrowserRouter([
	{
		path: "/",
		hydrateFallbackElement,
		lazy: () =>
			import("@/features/landing/routes").then((m) => ({
				Component: m.LandingRoutes,
			})),
	},
	{
		path: "/terms",
		hydrateFallbackElement,
		lazy: () =>
			import("@/features/legal/pages/TermsPage").then((m) => ({
				Component: m.TermsPage,
			})),
	},
	{
		path: "/privacy",
		hydrateFallbackElement,
		lazy: () =>
			import("@/features/legal/pages/PrivacyPage").then((m) => ({
				Component: m.PrivacyPage,
			})),
	},
	{
		hydrateFallbackElement,
		lazy: () =>
			import("./layouts/AuthSessionLayout").then((m) => ({
				Component: m.AuthSessionLayout,
			})),
		errorElement,
		children: [
			{
				path: "/login",
				lazy: () =>
					import("@/features/auth/routes").then((m) => ({
						Component: m.AuthRoutes,
					})),
			},
			{
				path: "/onboarding",
				lazy: () =>
					import("@/features/onboarding/components/OnboardingWizard").then(
						(m) => ({ Component: m.OnboardingWizard }),
					),
			},
			{
				hydrateFallbackElement,
				lazy: () =>
					import("./layouts/AppLayout").then((m) => ({
						Component: m.AppLayout,
					})),
				children: [
					{
						path: "/dashboard/*",
						lazy: () =>
							import("./pages/DashboardPage").then((m) => ({
								Component: m.DashboardPage,
							})),
					},
					{
						path: "/inventory/*",
						lazy: () =>
							import("@/features/inventory/routes").then((m) => ({
								Component: m.InventoryRoutes,
							})),
					},
					{
						path: "/recipes/*",
						lazy: () =>
							import("@/features/recipes/routes").then((m) => ({
								Component: m.RecipesRoutes,
							})),
					},
					{
						path: "/quotes/*",
						lazy: () =>
							import("@/features/quotes/routes").then((m) => ({
								Component: m.QuotesRoutes,
							})),
					},
					{
						path: "/crm/*",
						lazy: () =>
							import("@/features/crm/routes").then((m) => ({
								Component: m.CrmRoutes,
							})),
					},
					{
						path: "/tareas/*",
						lazy: () =>
							import("@/features/tasks/routes").then((m) => ({
								Component: m.TasksRoutes,
							})),
					},
					{
						path: "/settings/*",
						lazy: () =>
							import("@/features/settings/routes").then((m) => ({
								Component: m.SettingsRoutes,
							})),
					},
					{
						path: "/profile/*",
						lazy: () =>
							import("@/features/auth/routes").then((m) => ({
								Component: m.ProfileRoutes,
							})),
					},
				],
			},
		],
	},
]);
