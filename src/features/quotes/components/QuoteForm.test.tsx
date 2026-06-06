import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock only the hooks QuoteForm still uses internally (quotes hooks and shared hooks)
vi.mock("@/shared/hooks/useWorkshopId", () => ({
	useWorkshopId: () => "w1",
}));

vi.mock("../hooks/useQuotes", () => ({
	useQuote: vi.fn(() => ({ data: null })),
	useCreateQuote: vi.fn(() => ({ mutateAsync: vi.fn() })),
	useUpdateQuote: vi.fn(() => ({ mutateAsync: vi.fn() })),
	useGenerateQuoteNumber: vi.fn(() => ({ data: "P-0001" })),
}));

import { QuoteForm } from "./QuoteForm";
import type { Client } from "@/shared/types/client";
import type { FurnitureTemplateWithItems } from "@/shared/types/recipes";

const mockClients: Client[] = [
	{
		id: "c1",
		name: "Juan Pérez",
		email: "juan@test.com",
		phone: "555-0101",
		source: "otro",
		workshop_id: "w1",
		created_at: "2024-01-01T00:00:00Z",
		notes: null,
		updated_at: "2024-01-01T00:00:00Z",
	},
	{
		id: "c2",
		name: "María García",
		email: "maria@test.com",
		phone: "555-0102",
		source: "otro",
		workshop_id: "w1",
		created_at: "2024-01-01T00:00:00Z",
		notes: null,
		updated_at: "2024-01-01T00:00:00Z",
	},
];

const mockTemplateWithCost: FurnitureTemplateWithItems = {
	id: "t1",
	workshop_id: "w1",
	name: "Ropero 2 puertas",
	notes: null,
	category: null,
	tags: [],
	height_cm: null,
	width_cm: null,
	depth_cm: null,
	photo_url: null,
	suggested_margin_pct: null,
	params: [],
	created_at: "2024-01-01T00:00:00Z",
	updated_at: "2024-01-01T00:00:00Z",
	recipe_items: [
		{
			id: "ri-1",
			furniture_template_id: "t1",
			material_id: "mat-1",
			quantity: 2,
			waste_pct: 10,
			quantity_formula: null,
			material: {
				id: "mat-1",
				name: "Melamina 18mm",
				category: "madera",
				unit: "un",
				price_per_unit: 3000,
				wood_subtype: "placa",
				length_cm: 260,
				width_cm: 183,
				thickness_cm: 1.8,
			},
		},
		{
			id: "ri-2",
			furniture_template_id: "t1",
			material_id: "mat-2",
			quantity: 4,
			waste_pct: 0,
			quantity_formula: null,
			material: {
				id: "mat-2",
				name: "Bisagras",
				category: "herraje",
				unit: "un",
				price_per_unit: 250,
				wood_subtype: null,
				length_cm: null,
				width_cm: null,
				thickness_cm: null,
			},
		},
	],
	labor_items: [
		{
			id: "lab-1",
			workshop_id: "w1",
			furniture_template_id: "t1",
			description: "Mano de obra",
			hours: 3,
			rate: 2500,
			created_at: "2024-01-01T00:00:00Z",
		},
	],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MockClientForm(_props: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: (client: Client) => void;
}) {
	return null;
}

function makeQueryWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

describe("QuoteForm (WU4b prop-driven refactor)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders with props-provided clients and templates", () => {
		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<MemoryRouter>
					<QuoteForm
						clients={mockClients}
						templates={[]}
						clientFormComponent={MockClientForm}
					/>
				</MemoryRouter>
			</Wrapper>,
		);
		expect(screen.getByText(/Nuevo presupuesto/i)).toBeDefined();
		expect(screen.getByText("Juan Pérez")).toBeDefined();
		expect(screen.getByText("María García")).toBeDefined();
	});

	it("shows client data from props, not from internal CRM hooks", () => {
		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<MemoryRouter>
					<QuoteForm
						clients={mockClients}
						templates={[]}
						clientFormComponent={MockClientForm}
					/>
				</MemoryRouter>
			</Wrapper>,
		);
		expect(screen.getByText("Juan Pérez")).toBeDefined();
		expect(screen.getByText("María García")).toBeDefined();
	});

	it("renders without crashing when templates are provided via props", () => {
		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<MemoryRouter>
					<QuoteForm
						clients={[]}
						templates={[]}
						clientFormComponent={MockClientForm}
					/>
				</MemoryRouter>
			</Wrapper>,
		);
		expect(screen.getByText(/Nuevo presupuesto/i)).toBeDefined();
	});

	it("selects a client from props via click and enables advancing", () => {
		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<MemoryRouter>
					<QuoteForm
						clients={mockClients}
						templates={[]}
						clientFormComponent={MockClientForm}
					/>
				</MemoryRouter>
			</Wrapper>,
		);

		// Step 1 is active; find the "Siguiente" button
		const nextButton = screen.getByText("Siguiente");

		// Without a client selected, the next button should be disabled
		expect(nextButton.closest("button")).toBeDisabled();

		// Click on a client from props
		fireEvent.click(screen.getByText("Juan Pérez"));

		// After selecting a client, the next button should be enabled
		expect(nextButton.closest("button")).not.toBeDisabled();
	});

	it("selecting a template from props computes recipe cost via shared computeRecipeCost", () => {
		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<MemoryRouter>
					<QuoteForm
						clients={mockClients}
						templates={[mockTemplateWithCost]}
						clientFormComponent={MockClientForm}
					/>
				</MemoryRouter>
			</Wrapper>,
		);

		// Step 1: select a client to advance
		fireEvent.click(screen.getByText("Juan Pérez"));
		fireEvent.click(screen.getByText("Siguiente"));

		// Now on step 2 — click the template grid card ("Ropero 2 puertas")
		// QuoteForm renders templates as clickable grid buttons that directly
		// set template_id, name, and computed recipe_cost.
		// Use getAllByText because "Ropero 2 puertas" also appears in the
		// FurnitureSection Select dropdown as an accessible option.
		fireEvent.click(screen.getAllByText("Ropero 2 puertas")[0]);

		// The name input should be populated from the template
		const nameInput = screen.getByLabelText(
			/nombre del mueble/i,
		) as HTMLInputElement;
		expect(nameInput.value).toBe("Ropero 2 puertas");

		// recipe_cost should be computed from shared computeRecipeCost:
		// placa/un with dims → 1 piece × $3000 = $3000 (wood via computeWoodUsage + applyWaste 10%)
		// 4 × $250 herraje = $1000 (extras)
		// labor 3 × $2500 = $7500
		// total = 3000 + 1000 + 7500 = $11500
		const costInput = screen.getByLabelText(/costo base/i) as HTMLInputElement;
		expect(Number(costInput.value)).toBe(11500);
	});

	it("propagates client creation callback through the client form component slot", () => {
		const handleClientCreated = vi.fn();
		let capturedOnCreated: ((client: Client) => void) | null = null;

		function CaptureClientForm(props: {
			open: boolean;
			onOpenChange: (open: boolean) => void;
			onCreated: (client: Client) => void;
		}) {
			capturedOnCreated = props.onCreated;
			return null;
		}

		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<MemoryRouter>
					<QuoteForm
						clients={mockClients}
						templates={[]}
						onClientCreated={handleClientCreated}
						clientFormComponent={CaptureClientForm}
					/>
				</MemoryRouter>
			</Wrapper>,
		);

		// The ClientFormComponent is used inside ClientDialog, which gates on `open`.
		// Click "Crear cliente nuevo" to open the dialog and render the slot.
		fireEvent.click(screen.getByText(/crear cliente nuevo/i));

		// Now the ClientDialog renders CaptureClientForm, which captures onCreated
		expect(capturedOnCreated).not.toBeNull();

		// Simulate creating a client via the slot's callback
		const newClient: Client = {
			id: "c3",
			name: "Nuevo Cliente",
			email: "nuevo@test.com",
			phone: "555-9999",
			source: "otro",
			workshop_id: "w1",
			created_at: "2024-01-01T00:00:00Z",
			notes: null,
			updated_at: "2024-01-01T00:00:00Z",
		};
		capturedOnCreated!(newClient);

		// The parent-provided callback should be invoked with the new client
		expect(handleClientCreated).toHaveBeenCalledWith(newClient);

		// The form's internal handler also sets client_id via setValue,
		// which is part of the slot integration contract.
	});
});
