export type NavItem = {
	label: string;
	href: string;
};

export type LandingCta = {
	label: string;
	href: string;
};

export type HeroCopy = {
	eyebrow: string;
	headline: string;
	description: string;
	primaryCta: LandingCta;
	secondaryCta: LandingCta;
	note: string;
};

export const navItems: NavItem[] = [
	{ label: "Funciones", href: "#features" },
	{ label: "Cómo funciona", href: "#workflow" },
	{ label: "Precios", href: "#pricing" },
	{ label: "FAQ", href: "#faq" },
];

export const loginCta: LandingCta = {
	label: "Iniciar sesión",
	href: "/login",
};

export const heroCta: LandingCta = {
	label: "Empezar gratis",
	href: "/login",
};

export const secondaryCta: LandingCta = {
	label: "Ver cómo funciona",
	href: "#workflow",
};

export const heroCopy: HeroCopy = {
	eyebrow: "Para carpinteros independientes y talleres",
	headline: "Tu taller merece herramientas de profesional",
	description:
		"Controlá materiales, armá presupuestos en minutos y gestioná clientes — todo desde una sola app pensada para carpinteros.",
	primaryCta: heroCta,
	secondaryCta,
	note: "14 días gratis · Sin tarjeta · Cancelá cuando quieras",
};

export type FeatureItem = {
	icon: string;
	title: string;
	description: string;
};

export type WorkflowStep = {
	num: string;
	title: string;
	description: string;
};

export const features: FeatureItem[] = [
	{
		icon: "box",
		title: "Inventario inteligente",
		description:
			"Controlá stock de maderas, herrajes y acabados. Alertas automáticas cuando un material baja del mínimo.",
	},
	{
		icon: "couch",
		title: "Recetas de muebles",
		description:
			"Armá plantillas con lista de materiales. El costo se calcula solo cuando cambian los precios.",
	},
	{
		icon: "fileText",
		title: "Presupuestos en minutos",
		description:
			"Creá presupuestos profesionales con margen automático. Exportá por WhatsApp o PDF en un toque.",
	},
	{
		icon: "users",
		title: "CRM de clientes",
		description:
			"Pipeline Kanban para seguir cada trabajo. Historial completo de cada cliente y sus pedidos.",
	},
	{
		icon: "chart",
		title: "Dashboard con métricas",
		description:
			"Facturación, conversión y ticket promedio para tomar mejores decisiones en tu taller.",
	},
	{
		icon: "messageCircle",
		title: "WhatsApp integrado",
		description:
			"Enviá presupuestos y contratos directamente por WhatsApp con un PDF profesional.",
	},
];

export const workflowSteps: WorkflowStep[] = [
	{
		num: "01",
		title: "Cargá tus materiales",
		description: "Subí tu inventario con precios y stock mínimo. Solo una vez.",
	},
	{
		num: "02",
		title: "Armá tus muebles",
		description:
			"Creá recetas con los materiales que usás. El costo se actualiza solo.",
	},
	{
		num: "03",
		title: "Presupuestá y vendé",
		description:
			"Generá presupuestos profesionales y mandalos por WhatsApp.",
	},
];
