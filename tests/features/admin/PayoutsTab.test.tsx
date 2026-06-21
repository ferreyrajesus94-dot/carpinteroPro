import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PayoutsTab } from "../../../src/features/admin/components/PayoutsTab";

vi.mock("@/shared/providers/AuthProvider", () => ({
  useAuth: () => ({ isPlatformAdmin: true }),
}));

vi.mock("@/features/admin/api/referrals", () => ({
  getPayoutPending: vi.fn(),
  getPayoutHistory: vi.fn(),
  markCommissionsPaid: vi.fn(),
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

const MOCK_PAYOUT_RUNS = {
  payoutRuns: [
    {
      id: "pr-1",
      createdAt: "2026-03-01T10:00:00Z",
      totalAmount: 748.5,
      commissionCount: 2,
      reference: "TRANSFER-001",
      notes: "Pago mensual Feb 2026",
      createdBy: "admin@example.com",
      commissions: [
        {
          id: "c1",
          commissionAmount: 400.0,
          youtuberName: "Canal Madera",
          workshopName: "Taller del Este",
        },
        {
          id: "c2",
          commissionAmount: 348.5,
          youtuberName: "Canal Madera",
          workshopName: "Taller del Oeste",
        },
      ],
    },
  ],
};

const MOCK_PENDING = {
  youtubers: [
    {
      youtuberId: "yt-1",
      displayName: "Canal Madera",
      totalPendingAmount: 748.5,
      commissionCount: 2,
      commissions: [
        {
          id: "c1",
          commissionAmount: 400.0,
          occurredAt: "2026-01-15T10:00:00Z",
          workshopName: "Taller del Este",
        },
        {
          id: "c2",
          commissionAmount: 348.5,
          occurredAt: "2026-02-15T10:00:00Z",
          workshopName: "Taller del Oeste",
        },
      ],
    },
  ],
};

describe("PayoutsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(referralsApi.getPayoutHistory).mockResolvedValue(MOCK_PAYOUT_RUNS);
    vi.mocked(referralsApi.getPayoutPending).mockResolvedValue(MOCK_PENDING);
  });

  it("renders payout runs table", async () => {
    renderWithQuery(<PayoutsTab />);

    expect(
      await screen.findByRole("table", { name: /Historial de pagos/i }),
    ).toBeInTheDocument();
  });

  it("displays payout run data: total, count, reference", async () => {
    renderWithQuery(<PayoutsTab />);

    await screen.findByText("TRANSFER-001");
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/admin@example.com/)).toBeInTheDocument();
    expect(screen.getByText("Pago mensual Feb 2026")).toBeInTheDocument();
  });

  it("shows expandable rows with commission details", async () => {
    renderWithQuery(<PayoutsTab />);

    await screen.findByText("TRANSFER-001");

    // Click the expandable row (the first td in the first tr after thead)
    const expandButtons = screen.getAllByRole("row");
    const dataRow = expandButtons[1]; // first data row
    await userEvent.click(dataRow);

    // Expanded commission details should appear
    await screen.findByText("Taller del Este");
    expect(screen.getByText("Taller del Oeste")).toBeInTheDocument();
  });

  it("supports keyboard expand via Enter key", async () => {
    renderWithQuery(<PayoutsTab />);

    await screen.findByText("TRANSFER-001");

    const dataRow = screen.getAllByRole("row")[1];
    dataRow.focus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText("Taller del Este")).toBeInTheDocument();
    expect(screen.getByText("Taller del Oeste")).toBeInTheDocument();
  });

  it("supports keyboard expand via Space key", async () => {
    renderWithQuery(<PayoutsTab />);

    await screen.findByText("TRANSFER-001");

    const dataRow = screen.getAllByRole("row")[1];
    dataRow.focus();
    await userEvent.keyboard(" ");

    expect(await screen.findByText("Taller del Este")).toBeInTheDocument();
    expect(screen.getByText("Taller del Oeste")).toBeInTheDocument();
  });

  it('shows "Nuevo pago" button', async () => {
    renderWithQuery(<PayoutsTab />);

    await screen.findByText("TRANSFER-001");

    expect(
      screen.getByRole("button", { name: /Nuevo pago/i }),
    ).toBeInTheDocument();
  });

  it("opens modal on Nuevo pago click", async () => {
    renderWithQuery(<PayoutsTab />);

    await screen.findByText("TRANSFER-001");

    await userEvent.click(screen.getByRole("button", { name: /Nuevo pago/i }));

    expect(
      screen.getByRole("dialog", { name: /Nuevo pago/i }),
    ).toBeInTheDocument();
  });

  it("renders loading skeleton while data loads", () => {
    vi.mocked(referralsApi.getPayoutHistory).mockImplementation(
      () => new Promise(() => {}),
    );

    renderWithQuery(<PayoutsTab />);

    expect(
      screen.getByRole("status", { name: "Cargando pagos" }),
    ).toBeInTheDocument();
  });

  it("renders error state when API fails", async () => {
    vi.mocked(referralsApi.getPayoutHistory).mockRejectedValue(
      new Error("Failed to load"),
    );

    renderWithQuery(<PayoutsTab />);

    await screen.findByRole("alert", { name: "Error al cargar pagos" });
    expect(
      screen.getByText(/No se pudieron cargar los pagos/),
    ).toBeInTheDocument();
  });

  it("renders empty state when no payout runs exist", async () => {
    vi.mocked(referralsApi.getPayoutHistory).mockResolvedValue({
      payoutRuns: [],
    });

    renderWithQuery(<PayoutsTab />);

    await screen.findByText("No hay pagos registrados");
  });
});
