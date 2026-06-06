import { PriceSparkline } from "@/shared/ui/PriceSparkline";
import { computeCostHistory } from "../lib/computeCostHistory";
import type { PriceHistoryRow } from "@/shared/types/priceHistory";
import type { RecipeItemWithMaterial } from "../types";

interface Props {
	items: RecipeItemWithMaterial[];
	priceHistory: PriceHistoryRow[];
	width?: number;
	height?: number;
}

export function FurnitureCostSparkline({
	items,
	priceHistory,
	width,
	height,
}: Props) {
	const points = computeCostHistory(items, priceHistory);
	return <PriceSparkline data={points} width={width} height={height} />;
}
