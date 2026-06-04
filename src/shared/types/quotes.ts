import type { Database } from "./database";

export type QuoteStatus = Database["public"]["Enums"]["quote_status"];
export type MarginMode = Database["public"]["Enums"]["margin_mode"];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
	presupuesto: "Presupuesto",
	enviado: "Enviado",
	aprobado: "Aprobado",
	en_produccion: "En producción",
	entregado: "Entregado",
	cancelado: "Cancelado",
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
	presupuesto: "bg-gray-100 text-gray-700",
	enviado: "bg-blue-100 text-blue-700",
	aprobado: "bg-green-100 text-green-700",
	en_produccion: "bg-yellow-100 text-yellow-700",
	entregado: "bg-emerald-100 text-emerald-700",
	cancelado: "bg-red-100 text-red-700",
};

export const QUOTE_STATUS_HEX_COLORS: Record<QuoteStatus, string> = {
	presupuesto: "#9ca3af",
	enviado: "#60a5fa",
	aprobado: "#4ade80",
	en_produccion: "#facc15",
	entregado: "#34d399",
	cancelado: "#f87171",
};
