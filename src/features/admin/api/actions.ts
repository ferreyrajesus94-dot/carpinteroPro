import { supabase } from "@/shared/lib/supabase";
import type {
	AdminToggleSubscriptionResponse,
	AdminRetryWebhookResponse,
	AdminForceOnboardingResponse,
	MaintenanceModeState,
} from "../types";

export async function cancelSubscription(workshopId: string): Promise<{ status: string }> {
	const { data, error } = await supabase.functions.invoke("cancel-subscription", {
		body: { workshopId },
	});
	if (error) throw error;
	return data as { status: string };
}

export async function toggleSubscription(
	workshopId: string,
	action: "pause" | "resume",
): Promise<AdminToggleSubscriptionResponse> {
	const { data, error } = await supabase.functions.invoke("admin-toggle-subscription", {
		body: { workshopId, action },
	});
	if (error) throw error;
	return data as AdminToggleSubscriptionResponse;
}

export async function retryWebhook(eventId: string): Promise<AdminRetryWebhookResponse> {
	const { data, error } = await supabase.functions.invoke("admin-retry-webhook", {
		body: { eventId },
	});
	if (error) throw error;
	return data as AdminRetryWebhookResponse;
}

export async function forceOnboarding(profileId: string): Promise<AdminForceOnboardingResponse> {
	const { data, error } = await supabase.functions.invoke("admin-force-onboarding", {
		body: { profileId },
	});
	if (error) throw error;
	return data as AdminForceOnboardingResponse;
}

export async function toggleMaintenance(
	enabled: boolean,
	message?: string,
): Promise<MaintenanceModeState> {
	const { data, error } = await supabase.functions.invoke("admin-toggle-maintenance", {
		body: { enabled, message },
	});
	if (error) throw error;
	return data as MaintenanceModeState;
}
