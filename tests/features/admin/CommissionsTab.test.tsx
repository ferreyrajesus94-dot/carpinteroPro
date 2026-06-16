import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommissionsTab } from "../../../src/features/admin/components/CommissionsTab";

vi.mock("@/shared/providers/AuthProvider", () => ({
  useAuth: () => ({ isPlatformAdmin: true }),
}));

vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/features/admin/api/referrals", () => ({
  fetchAdminCommissions: vi.fn(),
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

const MOCK_COMMISSIONS = {
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
      occurredAt: "2026-01-15T10:00:00Z",
      workshopName: "Taller del Este",
    },
    {
      id: "c2",
      workshopId: "ws-2",
      youtuberId: "yt-1",
      youtuberName: "Canal Madera",
      referralCodeId: "rc-1",
      code: "PROMO20",
      subscriptionId: "sub-2",
      providerPaymentId: "mp_pay_2",
      paymentAmount: 3992,
      commissionPct: 15,
      commissionAmount: 598.8,
      currency: "ARS",
      occurredAt: "2026-02-15T10:00:00Z",
      workshopName: "Taller del Oeste",
    },
    {
      id: "c3",
      workshopId: "ws-3",
      youtuberId: "yt-2",
      youtuberName: "El Taller Carpintero",
      referralCodeId: "rc-2",
      code: "MADERA10",
      subscriptionId: "sub-3",
      providerPaymentId: "mp_pay_3",
      paymentAmount: 4990,
      commissionPct: 10,
      commissionAmount: 499,
      currency: "ARS",
      occurredAt: "2026-03-01T00:00:00Z",
      workshopName: "Mueblería Norte",
    },
  ],
};

describe("CommissionsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(referralsApi.fetchAdminCommissions).mockResolvedValue(MOCK_COMMISSIONS);
  });

  it("renders a loading skeleton while data loads", () => {
    vi.mocked(referralsApi.fetchAdminCommissions).mockImplementation(
      () => new Promise(() => {}),
    );

    renderWithQuery(<CommissionsTab />);

    expect(
      screen.getByRole("status", { name: "Cargando comisiones" }),
    ).toBeInTheDocument();
  });

  it("renders commission rows with youtuber name, code, workshop, amounts", async () => {
    renderWithQuery(<CommissionsTab />);

    const canalMadera = await screen.findAllByText("Canal Madera");
    expect(canalMadera.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Taller del Este")).toBeInTheDocument();
    const promoElements = screen.getAllByText("PROMO20");
    expect(promoElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("El Taller Carpintero")).toBeInTheDocument();
    expect(screen.getByText("MADERA10")).toBeInTheDocument();
    expect(screen.getByText("Mueblería Norte")).toBeInTheDocument();
  });

  it("renders formatted payment and commission amounts", async () => {
    renderWithQuery(<CommissionsTab />);

    await screen.findByText("Taller del Este");

    // ARS formatted amounts
    const amounts = screen.getAllByText(/\$\s*4\.990,00/);
    expect(amounts.length).toBeGreaterThanOrEqual(2); // c1 and c3 both have 4990
    expect(screen.getByText(/\$\s*3\.992,00/)).toBeInTheDocument();
    expect(screen.getByText(/\$\s*748,50/)).toBeInTheDocument();
    expect(screen.getByText(/\$\s*598,80/)).toBeInTheDocument();
  });

  it('renders Exportar CSV button', async () => {
    renderWithQuery(<CommissionsTab />);

    await screen.findByText("Taller del Este");

    expect(
      screen.getByRole("button", { name: /Exportar CSV/i }),
    ).toBeInTheDocument();
  });

  it('shows YouTuber filter select', async () => {
    renderWithQuery(<CommissionsTab />);

    await screen.findByText("Todos los youtubers");

    expect(
      screen.getByRole("combobox", { name: /Filtrar por youtuber/i }),
    ).toBeInTheDocument();
  });

  it("renders empty state when no commissions exist", async () => {
    vi.mocked(referralsApi.fetchAdminCommissions).mockResolvedValue({
      commissions: [],
    });

    renderWithQuery(<CommissionsTab />);

    await screen.findByText("No se encontraron comisiones");
  });

  it("renders error state when API fails", async () => {
    vi.mocked(referralsApi.fetchAdminCommissions).mockRejectedValue(
      new Error("Failed to load"),
    );

    renderWithQuery(<CommissionsTab />);

    await screen.findByRole("alert", { name: "Error al cargar comisiones" });
    expect(
      screen.getByText(/No se pudieron cargar las comisiones/),
    ).toBeInTheDocument();
  });

  it("renders filter select with option to select a youtuber", async () => {
    renderWithQuery(<CommissionsTab />);

    await screen.findByText("Taller del Este");

    // Filter select should be present
    const select = screen.getByRole("combobox", { name: /Filtrar por youtuber/i });
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("");
  });
});
