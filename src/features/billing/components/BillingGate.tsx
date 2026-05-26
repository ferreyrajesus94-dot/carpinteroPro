import { useEffect, useMemo, useState } from "react";
import { getBillingAccess } from "@/features/billing/lib/access";
import { BillingBlockedScreen } from "./BillingBlockedScreen";
import type { SubscriptionRow } from "@/features/billing/types";

interface BillingGateProps {
	subscription: SubscriptionRow | null | undefined;
	isLoading: boolean;
	onStartPayment?: () => void | Promise<void>;
	isPaymentLoading?: boolean;
	children: React.ReactNode;
}

const MAX_TIMEOUT_MS = 2_147_483_647;

function getNextAccessBoundary(
	subscription: SubscriptionRow | null | undefined,
) {
	if (!subscription) return null;

	if (subscription.status === "trialing" && subscription.trial_ends_at) {
		return new Date(subscription.trial_ends_at);
	}

	if (
		subscription.status === "active" &&
		subscription.cancel_at_period_end &&
		subscription.current_period_ends_at
	) {
		return new Date(subscription.current_period_ends_at);
	}

	return null;
}

export function BillingGate({
	subscription,
	isLoading,
	onStartPayment,
	isPaymentLoading = false,
	children,
}: BillingGateProps) {
	const [now, setNow] = useState(() => new Date());
	const access = getBillingAccess(subscription ?? null, now);
	const nextBoundary = useMemo(
		() => getNextAccessBoundary(subscription),
		[subscription],
	);

	useEffect(() => {
		if (!nextBoundary) return;

		const delay = Math.max(nextBoundary.getTime() - now.getTime(), 0);
		const timeout = window.setTimeout(
			() => setNow(new Date()),
			Math.min(delay, MAX_TIMEOUT_MS),
		);
		return () => window.clearTimeout(timeout);
	}, [nextBoundary, now]);

	if (isLoading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
			</div>
		);
	}

	if (access === "blocked" || access === "loading") {
		return (
			<BillingBlockedScreen
				subscription={subscription ?? null}
				onStartPayment={onStartPayment}
				isPaymentLoading={isPaymentLoading}
			/>
		);
	}

	return <>{children}</>;
}
