/**
 * Formatea un monto en ARS con 2 decimales.
 * Ej: 1234.5 → "$1.234,50"
 */
export function formatARS(amount: number): string {
	return new Intl.NumberFormat("es-AR", {
		style: "currency",
		currency: "ARS",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

/**
 * Formatea una fecha ISO con zona horaria Argentina.
 * Ej: "2026-01-15T14:30:00Z" → "15/01/2026, 11:30"
 */
export function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("es-AR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(iso));
}
