export interface PriceHistoryRow {
	id: string;
	material_id: string;
	workshop_id: string;
	old_price: number;
	new_price: number;
	changed_at: string;
}
