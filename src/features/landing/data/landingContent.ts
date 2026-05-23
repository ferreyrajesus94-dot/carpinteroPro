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
