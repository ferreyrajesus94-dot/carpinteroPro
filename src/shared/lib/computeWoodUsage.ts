import type { Material } from "@/shared/types/material";

export type WoodMaterial = Pick<
	Material,
	| "id"
	| "name"
	| "category"
	| "unit"
	| "price_per_unit"
	| "wood_subtype"
	| "length_cm"
	| "width_cm"
	| "thickness_cm"
>;

export type WoodUsageMode =
	| "placa-pieces" // se cobra por placa entera, input m² → ceil(m² / area_placa)
	| "placa-area" // se cobra por m², input m² → m² × precio
	| "lineal-pieces" // se cobra por tira entera, input metros → ceil(m / largo_tira)
	| "lineal-meters" // se cobra por metro lineal, input metros → m × precio
	| "flat"; // sin subtype/dim suficientes: input × precio (comportamiento legacy)

export interface WoodUsage {
	mode: WoodUsageMode;
	/** Lo que la persona escribe en el form: m² para placa, m lineales para tira, o cantidad para flat. */
	inputUnitLabel: string;
	/** Cuántas piezas físicas (placas / tiras) hacen falta. null cuando no aplica (flat / por m² / por m lineal). */
	piecesNeeded: number | null;
	/** Texto opcional con la medida de la pieza de stock para mostrar al usuario. Ej: "2.60 × 1.83 m" o "3.20 m". */
	pieceLabel: string | null;
	/** Costo total de la línea. */
	subtotal: number;
}

const cm2ToM2 = (cm2: number) => cm2 / 10_000;
const cmToM = (cm: number) => cm / 100;
const fmt = (n: number) =>
	new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

/**
 * Calcula cuánta madera se consume en un ítem de receta.
 * - Placa con unidad 'un' + medidas → ceil(m² / area_placa) × precio.
 * - Placa con unidad 'm2' → m² × precio (sin redondeo).
 * - Listón/Tirante/Columna con unidad 'un' + largo → ceil(m / largo_tira) × precio.
 * - Listón/Tirante/Columna con unidad 'm' → m × precio.
 * - Cualquier otra combinación → fallback plano (qty × precio), igual que antes.
 */
export function computeWoodUsage(
	material: WoodMaterial,
	quantity: number,
): WoodUsage {
	const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
	const price = material.price_per_unit ?? 0;
	const subtype = material.wood_subtype;
	const unit = material.unit;
	const len = material.length_cm;
	const wid = material.width_cm;

	// Placa
	if (subtype === "placa") {
		const pieceLabel =
			len != null && wid != null
				? `${fmt(cmToM(len))} × ${fmt(cmToM(wid))} m`
				: null;

		if (unit === "un" && len != null && wid != null) {
			const areaPerPiece = cm2ToM2(len * wid);
			const pieces = areaPerPiece > 0 ? Math.ceil(qty / areaPerPiece) : 0;
			return {
				mode: "placa-pieces",
				inputUnitLabel: "m²",
				piecesNeeded: pieces,
				pieceLabel,
				subtotal: pieces * price,
			};
		}

		if (unit === "m2") {
			return {
				mode: "placa-area",
				inputUnitLabel: "m²",
				piecesNeeded: null,
				pieceLabel,
				subtotal: qty * price,
			};
		}
	}

	// Listón / Tirante / Columna
	if (subtype === "liston" || subtype === "tirante" || subtype === "columna") {
		const pieceLabel = len != null ? `${fmt(cmToM(len))} m` : null;

		if (unit === "un" && len != null) {
			const lengthPerPiece = cmToM(len);
			const pieces = lengthPerPiece > 0 ? Math.ceil(qty / lengthPerPiece) : 0;
			return {
				mode: "lineal-pieces",
				inputUnitLabel: "m",
				piecesNeeded: pieces,
				pieceLabel,
				subtotal: pieces * price,
			};
		}

		if (unit === "m") {
			return {
				mode: "lineal-meters",
				inputUnitLabel: "m",
				piecesNeeded: null,
				pieceLabel,
				subtotal: qty * price,
			};
		}
	}

	// Sin subtype o combinación incompatible: comportamiento legacy.
	return {
		mode: "flat",
		inputUnitLabel: unit,
		piecesNeeded: null,
		pieceLabel: null,
		subtotal: qty * price,
	};
}
