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
