import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { WorkshopSettings } from "@/shared/types/workshopSettings";

// Mock supabase module to prevent env-var check during module loading
vi.mock("@/shared/lib/supabase", () => ({
	supabase: {
		auth: {
			getSession: vi
				.fn()
				.mockResolvedValue({ data: { session: null }, error: null }),
			onAuthStateChange: vi
				.fn()
				.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
			signOut: vi.fn().mockResolvedValue({ error: null }),
		},
		from: vi.fn().mockReturnValue({
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
		}),
	},
}));

vi.mock("@/shared/hooks/useWorkshopId", () => ({
	useWorkshopId: () => "test-workshop-id",
}));

vi.mock("../hooks/useQuotes", () => ({
	useQuote: () => ({
		data: {
			id: "quote-1",
			quote_number: "Q-001",
			client: { name: "Test Client", phone: "123456789" },
			furniture_name: "Test Furniture",
			recipe_cost: 10000,
			margin_mode: "on_cost",
			margin_pct: 30,
			extras: [{ amount: 500, show_in_quote: true, description: "Extra item" }],
		},
	}),
}));

vi.mock("../hooks/useContractTemplates", () => ({
	useContractTemplates: () => ({
		data: [
			{
				id: "tmpl-1",
				name: "Default Template",
				body_markdown:
					"**Cliente:** {{client_name}}\n**Taller:** {{workshop_name}}",
				is_default: true,
			},
		],
	}),
}));

vi.mock("../lib/pdf", () => ({
	generateQuotePDF: vi.fn(),
}));

vi.mock("date-fns", () => ({
	format: vi.fn().mockReturnValue("1 de enero de 2026"),
}));

import { ContractPreview } from "./ContractPreview";

describe("ContractPreview with workshopSettings prop", () => {
	const defaultSettings: WorkshopSettings = {
		workshop_id: "w-1",
		name: "Mi Taller",
		logo_url: null,
		phone: "555-1234",
		email: "info@mitaller.com",
		address: "Av. Siempre Viva 123",
		auto_stock_discount: false,
		default_labor_rate: null,
		stock_alert_enabled: false,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
	};

	function renderWithRouter(element: React.ReactElement) {
		return render(<MemoryRouter>{element}</MemoryRouter>);
	}

	it("renders with workshopSettings prop and displays contracted content", () => {
		renderWithRouter(<ContractPreview workshopSettings={defaultSettings} />);
		// The contract page heading renders the quote number.
		expect(screen.getByText("Contrato — Q-001")).toBeTruthy();
		// The component renders template content with client and workshop values.
		expect(screen.getByText(/Test Client/)).toBeTruthy();
		expect(screen.getByText(/Mi Taller/)).toBeTruthy();
	});
});
