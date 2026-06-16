import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/shared/providers/AuthProvider";
import {
	fetchAdminYoutubers,
	createYoutuber,
	updateYoutuber,
	toggleYoutuber,
	fetchReferralCodes,
	createReferralCode,
	deactivateReferralCode,
	fetchAdminCommissions,
} from "../api/referrals";
import type {
	CreateYoutuberRequest,
	UpdateYoutuberRequest,
	ToggleYoutuberRequest,
	CreateReferralCodeRequest,
	AdminCommissionsRequest,
} from "../types";

export const ADMIN_YOUTUBERS_KEY = "admin-youtubers" as const;
export const ADMIN_REFERRAL_CODES_KEY = "admin-referral-codes" as const;
export const ADMIN_COMMISSIONS_KEY = "admin-referral-commissions" as const;

export function useAdminYoutubers(search?: string) {
	const { isPlatformAdmin } = useAuth();

	return useQuery({
		queryKey: [ADMIN_YOUTUBERS_KEY, search ?? ""],
		queryFn: () => fetchAdminYoutubers(search),
		enabled: isPlatformAdmin,
		staleTime: 60_000,
	});
}

export function useReferralCodes(youtuberId?: string) {
	const { isPlatformAdmin } = useAuth();

	return useQuery({
		queryKey: [ADMIN_REFERRAL_CODES_KEY, youtuberId ?? ""],
		queryFn: () => fetchReferralCodes(youtuberId),
		enabled: isPlatformAdmin,
		staleTime: 60_000,
	});
}

export function useCreateYoutuber() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: CreateYoutuberRequest) => createYoutuber(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [ADMIN_YOUTUBERS_KEY] });
			toast.success("YouTuber creado");
		},
		onError: (e: Error) => toast.error(e.message),
	});
}

export function useUpdateYoutuber() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: UpdateYoutuberRequest) => updateYoutuber(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [ADMIN_YOUTUBERS_KEY] });
			toast.success("YouTuber actualizado");
		},
		onError: (e: Error) => toast.error(e.message),
	});
}

export function useToggleYoutuber() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: ToggleYoutuberRequest) => toggleYoutuber(input),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: [ADMIN_YOUTUBERS_KEY] });
			toast.success(
				data.isActive ? "YouTuber activado" : "YouTuber desactivado",
			);
		},
		onError: (e: Error) => toast.error(e.message),
	});
}

export function useCreateReferralCode() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: CreateReferralCodeRequest) => createReferralCode(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [ADMIN_REFERRAL_CODES_KEY] });
			toast.success("Código creado");
		},
		onError: (e: Error) => toast.error(e.message),
	});
}

export function useDeactivateReferralCode() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => deactivateReferralCode(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [ADMIN_REFERRAL_CODES_KEY] });
			toast.success("Código desactivado");
		},
		onError: (e: Error) => toast.error(e.message),
	});
}

export function useAdminCommissions(filters: AdminCommissionsRequest = {}) {
	const { isPlatformAdmin } = useAuth();

	return useQuery({
		queryKey: [ADMIN_COMMISSIONS_KEY, filters],
		queryFn: () => fetchAdminCommissions(filters),
		enabled: isPlatformAdmin,
		staleTime: 60_000,
	});
}
