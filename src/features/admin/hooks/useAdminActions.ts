import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	cancelSubscription,
	toggleSubscription,
	retryWebhook,
	forceOnboarding,
	toggleMaintenance,
	toggleWorkshop,
} from "../api/actions";
import { ADMIN_SUBSCRIPTIONS_KEY } from "./useAdminSubscriptions";
import { ADMIN_SUPPORT_DIAGNOSTICS_KEY } from "./useAdminSupportDiagnostics";
import { ADMIN_WORKSHOPS_KEY } from "./useAdminWorkshops";
import { ADMIN_OVERVIEW_KEY } from "./useAdminOverview";

export function useCancelSubscription() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (workshopId: string) => cancelSubscription(workshopId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [ADMIN_SUBSCRIPTIONS_KEY] });
			toast.success("Suscripción cancelada");
		},
		onError: (e: Error) => toast.error(e.message),
	});
}

export function useToggleSubscription() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			workshopId,
			action,
		}: {
			workshopId: string;
			action: "pause" | "resume";
		}) => toggleSubscription(workshopId, action),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: [ADMIN_SUBSCRIPTIONS_KEY] });
			toast.success(
				`Suscripción ${data.status === "paused" ? "pausada" : "reanudada"}`,
			);
		},
		onError: (e: Error) => toast.error(e.message),
	});
}

export function useRetryWebhook() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (eventId: string) => retryWebhook(eventId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: [ADMIN_SUPPORT_DIAGNOSTICS_KEY],
			});
			toast.success("Reintento enviado");
		},
		onError: (e: Error) => toast.error(e.message),
	});
}

export function useForceOnboarding() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (profileId: string) => forceOnboarding(profileId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [ADMIN_WORKSHOPS_KEY] });
			toast.success("Onboarding forzado");
		},
		onError: (e: Error) => toast.error(e.message),
	});
}

export function useToggleWorkshop() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			workshopId,
			active,
		}: {
			workshopId: string;
			active: boolean;
		}) => toggleWorkshop(workshopId, active),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: [ADMIN_WORKSHOPS_KEY] });
			toast.success(data.isActive ? "Taller activado" : "Taller desactivado");
		},
		onError: (e: Error) => toast.error(e.message),
	});
}

export function useToggleMaintenance() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			enabled,
			message,
		}: {
			enabled: boolean;
			message?: string;
		}) => toggleMaintenance(enabled, message),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: [ADMIN_OVERVIEW_KEY] });
			toast.success(
				data.enabled
					? "Modo mantenimiento activado"
					: "Modo mantenimiento desactivado",
			);
		},
		onError: (e: Error) => toast.error(e.message),
	});
}
