import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReferidosPage } from "../../../src/features/admin/components/ReferidosPage";

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({ isPlatformAdmin: true }),
}));

vi.mock("@/features/admin/api/referrals", () => ({
	fetchAdminYoutubers: vi.fn(),
	createYoutuber: vi.fn(),
	updateYoutuber: vi.fn(),
	toggleYoutuber: vi.fn(),
	fetchReferralCodes: vi.fn(),
	createReferralCode: vi.fn(),
	deactivateReferralCode: vi.fn(),
	fetchAdminCommissions: vi.fn(),
	getPayoutPending: vi.fn(),
	getPayoutHistory: vi.fn(),
	markCommissionsPaid: vi.fn(),
	exportCommissionsCsv: vi.fn(),
}));

import * as referralsApi from "@/features/admin/api/referrals";

function renderWithQuery(ui: ReactNode) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		createElement(
			QueryClientProvider,
			{ client },
			createElement(MemoryRouter, null, ui),
		),
	);
}

const MOCK_YOUTUBERS = {
	youtubers: [
		{
			id: "yt-1",
			displayName: "Canal Madera",
			channelUrl: "https://youtube.com/@canalmadera",
			contactEmail: "madera@example.com",
			payoutMethod: "mp",
			payoutCbu: null,
			payoutCvu: null,
			payoutAlias: null,
			payoutBankName: null,
			payoutHolderName: null,
			payoutHolderCuit: null,
			isActive: true,
			codeCount: 3,
			activeReferredWorkshops: 5,
			lifetimeCommission: 12475.5,
		},
		{
			id: "yt-2",
			displayName: "El Taller Carpintero",
			channelUrl: null,
			contactEmail: null,
			payoutMethod: null,
			payoutCbu: null,
			payoutCvu: null,
			payoutAlias: null,
			payoutBankName: null,
			payoutHolderName: null,
			payoutHolderCuit: null,
			isActive: false,
			codeCount: 1,
			activeReferredWorkshops: 2,
			lifetimeCommission: 4990.0,
		},
	],
};

describe("ReferidosPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(referralsApi.fetchAdminYoutubers).mockResolvedValue(
			MOCK_YOUTUBERS,
		);
		vi.mocked(referralsApi.fetchReferralCodes).mockResolvedValue({ codes: [] });
		vi.mocked(referralsApi.fetchAdminCommissions).mockResolvedValue({
			commissions: [
				{
					id: "c1",
					workshopId: "ws-1",
					youtuberId: "yt-1",
					youtuberName: "Canal Madera",
					referralCodeId: "rc-1",
					code: "PROMO20",
					subscriptionId: "sub-1",
					providerPaymentId: "mp_pay_1",
					paymentAmount: 4990,
					commissionPct: 15,
					commissionAmount: 748.5,
					currency: "ARS",
					status: "pending",
					occurredAt: "2026-01-15T10:00:00Z",
					workshopName: "Taller del Este",
				},
			],
		});
		vi.mocked(referralsApi.getPayoutPending).mockResolvedValue({
			youtubers: [
				{
					youtuberId: "yt-1",
					displayName: "Canal Madera",
					totalPendingAmount: 748.5,
					commissionCount: 1,
					commissions: [
						{
							id: "c1",
							commissionAmount: 748.5,
							occurredAt: "2026-01-15T10:00:00Z",
							workshopName: "Taller del Este",
						},
					],
				},
			],
		});
		vi.mocked(referralsApi.getPayoutHistory).mockResolvedValue({
			payoutRuns: [
				{
					id: "pr-1",
					createdAt: "2026-03-01T10:00:00Z",
					totalAmount: 748.5,
					commissionCount: 1,
					reference: "TEST-001",
					notes: null,
					createdBy: "admin@example.com",
					commissions: [
						{
							id: "c1",
							commissionAmount: 748.5,
							youtuberName: "Canal Madera",
							workshopName: "Taller del Este",
						},
					],
				},
			],
		});
	});

	it("renders a loading skeleton while data loads", () => {
		vi.mocked(referralsApi.fetchAdminYoutubers).mockImplementation(
			() => new Promise(() => {}),
		);

		renderWithQuery(<ReferidosPage />);

		expect(
			screen.getByRole("status", { name: "Cargando youtubers" }),
		).toBeInTheDocument();
	});

	it("renders the youtubers cards with data", async () => {
		renderWithQuery(<ReferidosPage />);

		await screen.findByText("Canal Madera");
		expect(screen.getByText("El Taller Carpintero")).toBeInTheDocument();
	});

	it("renders aggregated columns: codeCount, activeReferredWorkshops, lifetimeCommission", async () => {
		renderWithQuery(<ReferidosPage />);

		await screen.findByText("Canal Madera");

		// Formatted amounts confirm lifetimeCommission is displayed (es-AR format)
		expect(screen.getByText(/\$\s*12\.475,50/)).toBeInTheDocument();
		expect(screen.getByText(/\$\s*4\.990,00/)).toBeInTheDocument();

		// Active referral workshops count and code counts are visible
		expect(screen.getByText("5")).toBeInTheDocument();
		expect(screen.getByText("2")).toBeInTheDocument();
		expect(screen.getByText("3")).toBeInTheDocument();
		expect(screen.getByText("1")).toBeInTheDocument();
	});

	it('shows "Crear YouTuber" button', async () => {
		renderWithQuery(<ReferidosPage />);

		await screen.findByText("Canal Madera");

		expect(
			screen.getByRole("button", { name: /Crear YouTuber/i }),
		).toBeInTheDocument();
	});

	it('opens create dialog when "Crear YouTuber" is clicked', async () => {
		const { fireEvent } = await import("@testing-library/react");
		renderWithQuery(<ReferidosPage />);

		await screen.findByText("Canal Madera");

		const createButton = screen.getByRole("button", {
			name: /Crear YouTuber/i,
		});
		fireEvent.click(createButton);

		expect(
			screen.getByRole("dialog", { name: /Crear YouTuber/i }),
		).toBeInTheDocument();
	});

	it("validates bank fields on blur and prevents submit while invalid", async () => {
		renderWithQuery(<ReferidosPage />);

		await screen.findByText("Canal Madera");
		await userEvent.click(
			screen.getByRole("button", { name: /Crear YouTuber/i }),
		);

		await userEvent.type(
			screen.getByLabelText(/Nombre visible/i),
			"Nuevo Canal",
		);
		await userEvent.type(screen.getByLabelText(/CBU/i), "123");
		await userEvent.tab();

		expect(
			await screen.findByText("CBU debe tener 22 dígitos"),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Crear" })).toBeDisabled();
		expect(referralsApi.createYoutuber).not.toHaveBeenCalled();
	});

	it("renders error state when API fails", async () => {
		vi.mocked(referralsApi.fetchAdminYoutubers).mockRejectedValue(
			new Error("Service unavailable"),
		);

		renderWithQuery(<ReferidosPage />);

		await screen.findByRole("alert", { name: "Error al cargar youtubers" });
		expect(
			screen.getByText(/No se pudieron cargar los youtubers/),
		).toBeInTheDocument();
	});

	it("renders empty state when no youtubers exist", async () => {
		vi.mocked(referralsApi.fetchAdminYoutubers).mockResolvedValue({
			youtubers: [],
		});

		renderWithQuery(<ReferidosPage />);

		await screen.findByText("No se encontraron youtubers");
	});

	it("confirms deactivation with the shared confirmation dialog copy", async () => {
		renderWithQuery(<ReferidosPage />);

		await screen.findByText("Canal Madera");
		await userEvent.click(
			screen.getByRole("button", { name: "Desactivar Canal Madera" }),
		);

		expect(
			screen.getByRole("dialog", { name: "Desactivar este YouTuber?" }),
		).toBeInTheDocument();
		expect(
			screen.getByText("Los códigos nuevos no podrán usarlo."),
		).toBeInTheDocument();
		expect(screen.queryByText("¿Desactivar?")).not.toBeInTheDocument();
	});

	// SDD-12: Comisiones and Pagos tabs
	it('shows "Comisiones" tab', async () => {
		renderWithQuery(<ReferidosPage />);

		await screen.findByText("Canal Madera");

		expect(
			screen.getByRole("button", { name: /Comisiones/i }),
		).toBeInTheDocument();
	});

	it('shows "Pagos" tab', async () => {
		renderWithQuery(<ReferidosPage />);

		await screen.findByText("Canal Madera");

		expect(screen.getByRole("button", { name: /Pagos/i })).toBeInTheDocument();
	});

	it("switches to Comisiones tab on click", async () => {
		renderWithQuery(<ReferidosPage />);

		await screen.findByText("Canal Madera");

		await userEvent.click(screen.getByRole("button", { name: /Comisiones/i }));

		// The commissions table should be visible (wait for data to load)
		expect(
			await screen.findByRole("table", { name: /Comisiones/i }),
		).toBeInTheDocument();
	});

	it("switches to Pagos tab on click", async () => {
		renderWithQuery(<ReferidosPage />);

		await screen.findByText("Canal Madera");

		await userEvent.click(screen.getByRole("button", { name: /Pagos/i }));

		// The payout history table should be visible (wait for data to load)
		expect(
			await screen.findByRole("table", { name: /Historial de pagos/i }),
		).toBeInTheDocument();
	});
});
