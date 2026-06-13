import { supabase } from "@/shared/lib/supabase";
import type {
	AdminWorkshopsResponse,
	AdminWorkshopDetailResponse,
} from "../types";

export async function fetchAdminWorkshops(
	search?: string,
): Promise<AdminWorkshopsResponse> {
	const { data, error } = await supabase.functions.invoke("admin-workshops", {
		body: search ? { search } : {},
	});
	if (error) throw error;
	return data as AdminWorkshopsResponse;
}

export async function fetchAdminWorkshopDetail(
	workshopId: string,
): Promise<AdminWorkshopDetailResponse> {
	const { data, error } = await supabase.functions.invoke("admin-workshops", {
		body: { workshopId },
	});
	if (error) throw error;
	return data as AdminWorkshopDetailResponse;
}
