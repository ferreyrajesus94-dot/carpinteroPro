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
      isActive: true,
      codeCount: 3,
      activeReferredWorkshops: 5,
      lifetimeCommission: 12475.50,
    },
    {
      id: "yt-2",
      displayName: "El Taller Carpintero",
      channelUrl: null,
      contactEmail: null,
      payoutMethod: null,
      isActive: false,
      codeCount: 1,
      activeReferredWorkshops: 2,
      lifetimeCommission: 4990.00,
    },
  ],
};

describe("ReferidosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(referralsApi.fetchAdminYoutubers).mockResolvedValue(MOCK_YOUTUBERS);
    vi.mocked(referralsApi.fetchReferralCodes).mockResolvedValue({ codes: [] });
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

    const createButton = screen.getByRole("button", { name: /Crear YouTuber/i });
    fireEvent.click(createButton);

    expect(
      screen.getByRole("dialog", { name: /Crear YouTuber/i }),
    ).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("button", { name: "Desactivar Canal Madera" }));

    expect(
      screen.getByRole("dialog", { name: "Desactivar este YouTuber?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Los códigos nuevos no podrán usarlo."),
    ).toBeInTheDocument();
    expect(screen.queryByText("¿Desactivar?")).not.toBeInTheDocument();
  });
});
