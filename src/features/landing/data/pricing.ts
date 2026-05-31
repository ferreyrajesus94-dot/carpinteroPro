import { BILLING_PRICE } from "@/shared/constants/billingPricing";

export type PricingPlan = {
	name: string;
	price: string;
	currency: string;
	cadence: string;
	description: string;
	features: string[];
	ctaLabel: string;
	ctaHref: string;
};

export const pricingPlan: PricingPlan = {
	name: "Pro — Mensual",
	price: BILLING_PRICE.display,
	currency: BILLING_PRICE.currency,
	cadence: BILLING_PRICE.cadence,
	description: "14 días de prueba gratis · Cancelá cuando quieras",
	features: [
		"Inventario ilimitado de materiales",
		"Recetas de muebles con costo auto",
		"Presupuestos profesionales con PDF",
		"Envío por WhatsApp integrado",
		"CRM con pipeline Kanban",
		"Dashboard con métricas en vivo",
		"Contratos editables",
		"Soporte por WhatsApp",
	],
	ctaLabel: "Empezar gratis",
	ctaHref: "/login",
};
