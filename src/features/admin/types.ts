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
	ownerEmail: string | null;
	profileCount: number;
	onboardedProfileCount: number;
	subscriptionStatus: string | null;
}

export interface AdminWorkshopsResponse {
	workshops: AdminWorkshopSummary[];
}

export interface AdminWorkshopDetailResponse {
	workshop: AdminWorkshopSummary;
}
