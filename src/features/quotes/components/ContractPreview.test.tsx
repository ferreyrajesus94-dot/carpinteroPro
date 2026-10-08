import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const templateMocks = vi.hoisted(() => ({
 templates: [{id: "tmpl-1", name: "Default Template", body_markdown: "**Cliente:** {{client_name}}\n**Taller:** {{workshop_name}}", is_default: true}],
 create: vi.fn(),
}));
vi.mock("../hooks/useContractTemplates", () => ({
 useContractTemplates: () => ({ data: templateMocks.templates, isLoading: false, isError: false }),
 useCreateContractTemplate: () => ({ mutateAsync: templateMocks.create, isPending: false, isError: false }),
}));

vi.mock("../lib/pdf", () => ({
	generateQuotePDF: vi.fn(),
}));

vi.mock("date-fns", () => ({
	format: vi.fn().mockReturnValue("1 de enero de 2026"),
}));

import { generateQuotePDF } from "../lib/pdf";
import { ContractPreview } from "./ContractPreview";

describe("ContractPreview with workshopSettings prop", () => {
 beforeEach(() => {
  vi.clearAllMocks();
  templateMocks.templates = [{id: "tmpl-1", name: "Default Template", body_markdown: "**Cliente:** {{client_name}}\n**Taller:** {{workshop_name}}", is_default: true}];
 });
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
 it("creates the first template from the empty state and selects it", async () => {
  templateMocks.templates = [];
  templateMocks.create.mockImplementation(async (data) => {
   const template = { ...data, id: "created-template" };
   templateMocks.templates = [template];
   return template;
  });
  renderWithRouter(<ContractPreview workshopSettings={defaultSettings} />);
  fireEvent.click(screen.getByRole("button", { name: "Nueva plantilla" }));
  fireEvent.change(screen.getByLabelText("Nombre de la plantilla"), {target: {value: "Acuerdo"}});
  fireEvent.change(screen.getByLabelText("Texto del contrato"), {target: {value: "Entrega para {{client_name}}"}});
  fireEvent.click(screen.getByRole("button", {name: "Guardar plantilla"}));
  await waitFor(() => expect(screen.getByText("Entrega para Test Client")).toBeTruthy());
  expect(templateMocks.create).toHaveBeenCalledWith({workshop_id: "test-workshop-id", name: "Acuerdo", body_markdown: "Entrega para {{client_name}}", is_default: true});
 });
 it("includes edited contract text in the downloaded PDF and escapes HTML", () => {
  const {container} = renderWithRouter(<ContractPreview workshopSettings={defaultSettings} />);
  fireEvent.click(screen.getByRole("button", {name: "Editar"}));
  fireEvent.change(screen.getByRole("textbox"), {target: {value: '<img src=x onerror="alert(1)"> Entrega pactada'}});
  fireEvent.click(screen.getByRole("button", {name: "Listo"}));
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByText(/Entrega pactada/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "Descargar presupuesto y contrato"}));
  expect(generateQuotePDF).toHaveBeenCalledWith(expect.objectContaining({contract: '<img src=x onerror="alert(1)"> Entrega pactada'}));
 });
 it("keeps a failed template draft available for retry", async () => {
  templateMocks.templates = [];
  templateMocks.create.mockRejectedValue(new Error("Offline"));
  renderWithRouter(<ContractPreview workshopSettings={defaultSettings} />);
  fireEvent.click(screen.getByRole("button", {name: "Nueva plantilla"}));
  fireEvent.change(screen.getByLabelText("Nombre de la plantilla"), {target: {value: "Acuerdo"}});
  fireEvent.change(screen.getByLabelText("Texto del contrato"), {target: {value: "Entrega pactada"}});
  fireEvent.click(screen.getByRole("button", {name: "Guardar plantilla"}));
  await waitFor(() => expect(templateMocks.create).toHaveBeenCalledOnce());
  expect(screen.getByLabelText("Texto del contrato")).toHaveValue("Entrega pactada");
 });

});
