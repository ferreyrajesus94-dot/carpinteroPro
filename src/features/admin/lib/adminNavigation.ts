import { ChartPie, Building, CreditCard, Megaphone, LifeBuoy, type LucideIcon } from "lucide-react";

export const ADMIN_NAV_ITEMS = [
	{ to: "/admin", label: "Resumen", icon: ChartPie },
	{ to: "/admin/workshops", label: "Talleres", icon: Building },
	{ to: "/admin/billing", label: "Billing", icon: CreditCard },
	{ to: "/admin/referidos", label: "Referidos", icon: Megaphone },
	{ to: "/admin/support", label: "Soporte", icon: LifeBuoy },
] as const satisfies readonly { to: string; label: string; icon: LucideIcon }[];
