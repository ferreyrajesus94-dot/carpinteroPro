import type { Database } from "@/shared/types/database";

export type SubscriptionRow =
	Database["public"]["Tables"]["subscriptions"]["Row"];

export type BillingAccess = "allowed" | "blocked" | "loading";
