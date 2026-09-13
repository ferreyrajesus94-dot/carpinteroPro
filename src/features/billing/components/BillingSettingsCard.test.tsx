import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BillingSettingsCard } from "./BillingSettingsCard";
import type { SubscriptionRow } from "@/features/billing/types";

function makeSub(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
	return {
		id: "sub-1",
		workshop_id: "ws-1",
		status: "cancelled",
		plan: "pro_monthly",
		provider: "mercadopago",
		trial_starts_at: "2026-01-01T00:00:00Z",
		trial_ends_at: "2026-01-15T00:00:00Z",
		current_period_starts_at: null,
		current_period_ends_at: null,
		provider_subscription_id: null,
		provider_preapproval_id: null,
		provider_status: null,
		first_period_discount_pct: null,
		referred_by_referral_code_id: null,
		cancel_at_period_end: false,
		cancelled_at: null,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

const FORBIDDEN_CTA_REGEX = /(suscrib|cancelar|empezar|actualizar pago|mercadopago)/i;

beforeEach(() => {
	// Confirm the regex actually catches the strings we promise it catches.
	// This makes the negative assertion below honest — if someone weakens
	// the regex, this guard fails first.
	expect("Suscribirse").toMatch(FORBIDDEN_CTA_REGEX);
	expect("Empezar suscripción").toMatch(FORBIDDEN_CTA_REGEX);
	expect("Actualizar pago").toMatch(FORBIDDEN_CTA_REGEX);
	expect("Cancelar").toMatch(FORBIDDEN_CTA_REGEX);
});

function assertNoForbiddenCta(container: HTMLElement) {
	const buttons = Array.from(container.querySelectorAll("button"));
	for (const button of buttons) {
		expect(button.textContent ?? "").not.toMatch(FORBIDDEN_CTA_REGEX);
	}
	// Defence in depth: also walk every text node so even a non-button
	// interactive element cannot smuggle a CTA in.
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	while (node) {
		expect(node.nodeValue ?? "").not.toMatch(FORBIDDEN_CTA_REGEX);
		node = walker.nextNode();
	}
}

describe("BillingSettingsCard (read-only)", () => {
	it("renders the Facturación section heading", () => {
		const { container } = render(<BillingSettingsCard subscription={null} />);
		expect(screen.getByText("Facturación")).toBeInTheDocument();
		assertNoForbiddenCta(container);
	});

	it("shows the historical status badge when a subscription row exists", () => {
		const { container } = render(
			<BillingSettingsCard subscription={makeSub({ status: "cancelled" })} />,
		);
		const badge = screen.getByTestId("billing-status-badge");
		expect(badge).toHaveTextContent(/canc/i);
		expect(screen.getByText(/CarpinteroPro es gratuito/i)).toBeInTheDocument();
		assertNoForbiddenCta(container);
	});

	it("renders one status badge for every historical subscription status", () => {
		const statuses: SubscriptionRow["status"][] = [
			"active",
			"trialing",
			"past_due",
			"unpaid",
			"cancelled",
		];
		for (const status of statuses) {
			const { unmount } = render(
				<BillingSettingsCard subscription={makeSub({ status })} />,
			);
			expect(screen.getByTestId("billing-status-badge")).toBeInTheDocument();
			assertNoForbiddenCta(document.body);
			unmount();
		}
	});

	it("shows 'Sin suscripción activa' when no subscription row exists", () => {
		const { container } = render(
			<BillingSettingsCard subscription={null} isLoading={false} />,
		);
		expect(screen.getByTestId("billing-no-subscription")).toHaveTextContent(
			/Sin suscripci[oó]n activa/,
		);
		assertNoForbiddenCta(container);
	});

	it("never renders subscribe/cancel/start/update CTA in any state", () => {
		const states: Array<Parameters<typeof BillingSettingsCard>[0]> = [
			{ subscription: null, isLoading: false },
			{ subscription: null, isLoading: true },
			{ subscription: makeSub({ status: "active" }) },
			{ subscription: makeSub({ status: "trialing" }) },
			{ subscription: makeSub({ status: "past_due" }) },
			{ subscription: makeSub({ status: "unpaid" }) },
			{ subscription: makeSub({ status: "cancelled" }) },
			{ subscription: makeSub({ status: "active", cancel_at_period_end: true }) },
		];
		for (const props of states) {
			const { unmount, container } = render(<BillingSettingsCard {...props} />);
			assertNoForbiddenCta(container);
			unmount();
		}
	});

	it("does not render ARS pricing or any MercadoPago hint in any state", () => {
		const states: Array<Parameters<typeof BillingSettingsCard>[0]> = [
			{ subscription: null },
			{ subscription: makeSub({ status: "active" }) },
			{ subscription: makeSub({ status: "trialing" }) },
		];
		for (const props of states) {
			const { unmount } = render(<BillingSettingsCard {...props} />);
			expect(screen.queryByText(/ARS/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/4\.? ?990/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/MercadoPago/i)).not.toBeInTheDocument();
			unmount();
		}
	});
});
