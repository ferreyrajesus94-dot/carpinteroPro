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
	presupuesto: "chip-presupuesto",
	enviado: "chip-enviado",
	aprobado: "chip-aprobado",
	en_produccion: "chip-en_produccion",
	entregado: "chip-entregado",
	cancelado: "chip-cancelado",
};

export const QUOTE_STATUS_HEX_COLORS: Record<QuoteStatus, string> = {
	presupuesto: "#9ca3af",
	enviado: "#60a5fa",
	aprobado: "#4ade80",
	en_produccion: "#facc15",
	entregado: "#34d399",
	cancelado: "#f87171",
};
