import { supabase } from "@/shared/lib/supabase";
import type {
	AdminYoutubersResponse,
	AdminReferralCodesResponse,
	AdminCommissionsResponse,
	AdminCommissionsRequest,
	CreateYoutuberRequest,
	UpdateYoutuberRequest,
	ToggleYoutuberRequest,
	CreateReferralCodeRequest,
	ApiSuccessResponse,
	ApiToggleResponse,
} from "../types";

export async function fetchAdminYoutubers(
	search?: string,
	youtuberId?: string,
): Promise<AdminYoutubersResponse> {
	const { data, error } = await supabase.functions.invoke("admin-youtubers", {
		body: {
			...(search ? { search } : {}),
			...(youtuberId ? { youtuberId } : {}),
		},
	});
	if (error) throw error;
	return data as AdminYoutubersResponse;
}

export async function createYoutuber(
	input: CreateYoutuberRequest,
): Promise<ApiSuccessResponse> {
	const { data, error } = await supabase.functions.invoke(
		"admin-youtube-mutate",
		{
			body: { action: "create", ...input },
		},
	);
	if (error) throw error;
	return data as ApiSuccessResponse;
}

export async function updateYoutuber(
	input: UpdateYoutuberRequest,
): Promise<ApiSuccessResponse> {
	const { data, error } = await supabase.functions.invoke(
		"admin-youtube-mutate",
		{
			body: { action: "update", ...input },
		},
	);
	if (error) throw error;
	return data as ApiSuccessResponse;
}

export async function toggleYoutuber(
	input: ToggleYoutuberRequest,
): Promise<ApiToggleResponse> {
	const { data, error } = await supabase.functions.invoke(
		"admin-youtube-mutate",
		{
			body: { action: "toggle", ...input },
		},
	);
	if (error) throw error;
	return data as ApiToggleResponse;
}

export async function fetchReferralCodes(
	youtuberId?: string,
): Promise<AdminReferralCodesResponse> {
	const { data, error } = await supabase.functions.invoke(
		"admin-referral-codes",
		{
			body: {
				action: "list",
				...(youtuberId ? { youtuberId } : {}),
			},
		},
	);
	if (error) throw error;
	return data as AdminReferralCodesResponse;
}

export async function createReferralCode(
	input: CreateReferralCodeRequest,
): Promise<ApiSuccessResponse> {
	const { data, error } = await supabase.functions.invoke(
		"admin-referral-codes",
		{
			body: { action: "create", ...input },
		},
	);
	if (error) throw error;
	return data as ApiSuccessResponse;
}

export async function deactivateReferralCode(
	id: string,
): Promise<ApiSuccessResponse> {
	const { data, error } = await supabase.functions.invoke(
		"admin-referral-codes",
		{
			body: { action: "deactivate", id },
		},
	);
	if (error) throw error;
	return data as ApiSuccessResponse;
}

export async function fetchAdminCommissions(
	request: AdminCommissionsRequest = {},
): Promise<AdminCommissionsResponse> {
	const { data, error } = await supabase.functions.invoke(
		"admin-referral-commissions",
		{
			body: request,
		},
	);
	if (error) throw error;
	return data as AdminCommissionsResponse;
}

export async function exportCommissionsCsv(
	request: AdminCommissionsRequest = {},
): Promise<string> {
	const { data, error } = await supabase.functions.invoke(
		"admin-referral-commissions",
		{
			body: { ...request, format: "csv" },
		},
	);
	if (error) throw error;
	return data as string;
}
