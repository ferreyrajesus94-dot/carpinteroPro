export interface AdminOverviewResponse {
	workshops: {
		total: number;
		createdLast30Days: number;
	};
	subscriptions: {
		total: number;
		byStatus: Record<string, number>;
	};
	support: {
		recentWebhookFailures: number;
	};
}

export interface AdminWorkshopSummary {
	id: string;
	name: string;
	createdAt: string;
	isActive: boolean;
	ownerEmail: string | null;
	profileCount: number;
	onboardedProfileCount: number;
	subscriptionStatus: string | null;
}

export interface AdminWorkshopsResponse {
	workshops: AdminWorkshopSummary[];
}

export interface AdminWorkshopProfile {
	id: string;
	onboardedAt: string | null;
	email: string | null;
}

export interface AdminWorkshopDetailResponse {
	workshop: AdminWorkshopSummary & {
		profiles: AdminWorkshopProfile[];
	};
}

export interface AdminSubscriptionSummary {
	id: string;
	workshopId: string;
	workshopName: string;
	status: string;
	plan: string;
	provider: string;
	providerPreapprovalId: string | null;
	providerStatus: string | null;
	currentPeriodEnd: string | null;
	updatedAt: string;
}

export interface AdminSubscriptionsResponse {
	subscriptions: AdminSubscriptionSummary[];
}

export interface AdminSupportDiagnostic {
	id: string;
	provider: string;
	providerEventId: string;
	eventType: string;
	providerResourceId: string | null;
	workshopId: string;
	processedAt: string;
	updatedAt: string;
}

export interface AdminSupportDiagnosticsResponse {
	diagnostics: AdminSupportDiagnostic[];
}

export interface AdminToggleSubscriptionRequest {
	workshopId: string;
	action: "pause" | "resume";
}

export interface AdminToggleSubscriptionResponse {
	status: string;
	updatedAt: string;
}

export interface AdminToggleWorkshopResponse {
	workshopId: string;
	isActive: boolean;
}

export interface AdminRetryWebhookRequest {
	eventId: string;
}

export interface AdminRetryWebhookResponse {
	status: "sent" | "error";
}

export interface AdminForceOnboardingRequest {
	profileId: string;
}

export interface AdminForceOnboardingResponse {
	onboardedAt: string;
}

export interface AdminMaintenanceToggleRequest {
	enabled: boolean;
	message?: string;
}

export interface MaintenanceModeState {
	enabled: boolean;
	message: string;
}

// Referral types (SDD-11)
export interface YoutuberSummary {
	id: string;
	displayName: string;
	channelUrl: string | null;
	contactEmail: string | null;
	payoutMethod: string | null;
	payoutCbu: string | null;
	payoutCvu: string | null;
	payoutAlias: string | null;
	payoutBankName: string | null;
	payoutHolderName: string | null;
	payoutHolderCuit: string | null;
	isActive: boolean;
	codeCount: number;
	activeReferredWorkshops: number;
	lifetimeCommission: number;
}

export interface AdminYoutubersResponse {
	youtubers: YoutuberSummary[];
}

export interface CreateYoutuberRequest {
	displayName: string;
	channelUrl?: string | null;
	contactEmail?: string | null;
	payoutMethod?: string | null;
	payoutCbu?: string | null;
	payoutCvu?: string | null;
	payoutAlias?: string | null;
	payoutBankName?: string | null;
	payoutHolderName?: string | null;
	payoutHolderCuit?: string | null;
}

export interface UpdateYoutuberRequest {
	id: string;
	displayName?: string;
	channelUrl?: string | null;
	contactEmail?: string | null;
	payoutMethod?: string | null;
	payoutCbu?: string | null;
	payoutCvu?: string | null;
	payoutAlias?: string | null;
	payoutBankName?: string | null;
	payoutHolderName?: string | null;
	payoutHolderCuit?: string | null;
}

export interface ToggleYoutuberRequest {
	id: string;
	isActive: boolean;
}

export interface ReferralCodeSummary {
	id: string;
	youtuberId: string;
	youtuberName: string | null;
	code: string;
	discountPct: number;
	commissionPct: number;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface AdminReferralCodesResponse {
	codes: ReferralCodeSummary[];
}

export interface CreateReferralCodeRequest {
	youtuberId: string;
	code: string;
	discountPct: number;
	commissionPct: number;
}

export interface CommissionSummary {
	id: string;
	workshopId: string;
	youtuberId: string;
	youtuberName: string | null;
	referralCodeId: string;
	code: string | null;
	subscriptionId: string | null;
	providerPaymentId: string;
	paymentAmount: number;
	commissionPct: number;
	commissionAmount: number;
	currency: string;
	status: string;
	occurredAt: string;
	workshopName: string | null;
}

export interface AdminCommissionsResponse {
	commissions: CommissionSummary[];
}

export interface AdminCommissionsRequest {
	youtuberId?: string;
	fromDate?: string;
	toDate?: string;
	limit?: number;
	format?: "json" | "csv";
}

export interface ApiSuccessResponse {
	id: string;
}

export interface ApiToggleResponse {
	id: string;
	isActive: boolean;
}
