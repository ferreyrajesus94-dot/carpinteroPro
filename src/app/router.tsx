import { createBrowserRouter } from "react-router-dom";
import { RouteErrorFallback } from "@/shared/components/RouteErrorFallback";

const hydrateFallbackElement = <div className="min-h-screen bg-background" />;

const errorElement = <RouteErrorFallback />;

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
					import("./pages/OnboardingPage").then((m) => ({
						Component: m.OnboardingPage,
					})),
			},
			{
				path: "/admin/*",
				lazy: () =>
					import("@/features/admin").then((m) => ({
						Component: m.AdminRoutes,
					})),
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
							import("./pages/RecipesPage").then((m) => ({
								Component: m.RecipesPage,
							})),
						errorElement,
					},
					{
						path: "/quotes/new",
						lazy: () =>
							import("@/app/pages/QuoteCreatorPage").then((m) => ({
								Component: m.QuoteCreatorPage,
							})),
						errorElement,
					},
					{
						path: "/quotes/templates",
						lazy: () =>
							import("@/features/quotes").then((m) => ({
								Component: m.TemplateEditor,
							})),
						errorElement,
					},
					{
						path: "/quotes/:id",
						lazy: () =>
							import("@/app/pages/QuoteCreatorPage").then((m) => ({
								Component: m.QuoteCreatorPage,
							})),
						errorElement,
					},
					{
						path: "/quotes/:id/contract",
						lazy: () =>
							import("@/app/pages/QuoteContractPage").then((m) => ({
								Component: m.QuoteContractPage,
							})),
						errorElement,
					},
					{
						path: "/quotes/*",
						lazy: () =>
							import("@/features/quotes").then((m) => ({
								Component: m.QuotesRoutes,
							})),
					},
					{
						path: "/crm/clientes",
						lazy: () =>
							import("@/app/pages/CrmClientsPage").then((m) => ({
								Component: m.CrmClientsPage,
							})),
						errorElement,
					},
					{
						path: "/crm/clientes/:id",
						lazy: () =>
							import("@/app/pages/CrmClientDetailPage").then((m) => ({
								Component: m.CrmClientDetailPage,
							})),
						errorElement,
					},
					{
						path: "/crm/*",
						lazy: () =>
							import("@/features/crm/routes").then((m) => ({
								Component: m.CrmRoutes,
							})),
					},
					{
						path: "/buscar",
						lazy: () =>
							import("@/features/search").then((m) => ({
								Component: m.SearchRoutes,
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
							import("./pages/SettingsPage").then((m) => ({
								Component: m.SettingsPage,
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
