// Formatea números al estilo argentino: 1234567.89 → "$1.234.568"
export function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("es-AR", {
		style: "currency",
		currency: "ARS",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
}
