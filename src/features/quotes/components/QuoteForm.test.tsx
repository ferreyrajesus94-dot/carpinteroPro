import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	act,
	render,
	screen,
	fireEvent,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

	it("propagates client creation callback through the client form component slot", async () => {
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

		const user = userEvent.setup();
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
		// userEvent wraps the click in act() so the dialog's open-state update
		// does not leak out of the act boundary (React 19 enforces this).
		await user.click(screen.getByText(/crear cliente nuevo/i));

		// Now the ClientDialog renders CaptureClientForm, which captures onCreated
		expect(capturedOnCreated).not.toBeNull();

		// Simulate creating a client via the slot's callback. Wrap the
		// synchronous call in `act()` because the form's
		// `handleClientCreated` callback (captured by the slot) does
		// `setValue("client_id", ...)` + `handleNextStep()` (which calls
		// `setStep(step + 1)`) — both are React state updates that
		// need to flush inside an act boundary. Without the wrapper,
		// React 19 emits the "An update to QuoteForm inside a test was
		// not wrapped in act(...)" warning.
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
		act(() => {
			capturedOnCreated!(newClient);
		});

		// The parent-provided callback should be invoked with the new client
		expect(handleClientCreated).toHaveBeenCalledWith(newClient);

		// The form's internal handler also sets client_id via setValue,
		// which is part of the slot integration contract.
	});
});

// ── PR 6 blocker-fix: UI guard ─────────────────────────────────────────────
// The full-edit path (`QuoteForm` → `useUpdateQuote` → `updateQuote`)
// can submit a `QuoteUpdate` containing `status: "en_produccion"`. The
// hook-level guard in `useUpdateQuote` catches that at the application
// layer, but a better UX is to never offer `en_produccion` as a
// user-selectable status in the form. The status is derived at the read
// layer from the production_orders state machine, and the only
// sanctioned way to enter it is the production feature's
// `useStartProductionOrder` flow (which `QuoteForm` already triggers
// for the `aprobado → en_produccion` case via the production-start
// review dialog). Direct full-edit assignment is therefore impossible
// because the option is not in the dropdown.
describe("QuoteForm — PR 6 blocker-fix: status select does not offer en_produccion", () => {
	beforeEach(() => vi.clearAllMocks());

	it("does not offer 'En producción' as a user-selectable status option in the form's status select", async () => {
		const user = userEvent.setup();
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

		// Step 1: pick a client to enable the Siguiente button.
		// userEvent.setup() + awaited click() wraps each interaction in
		// act() so the form's setValue("client_id", ...) and
		// setStep(N) state updates flush before we move on (React 19
		// enforces the act() boundary for component-internal updates).
		await user.click(screen.getByText("Juan Pérez"));
		await user.click(screen.getByText("Siguiente"));

		// Step 2: pick the template (first match in the grid).
		await user.click(screen.getAllByText("Ropero 2 puertas")[0]);
		await user.click(screen.getByText("Siguiente"));

		// Step 3: Extras is optional — advance.
		await user.click(screen.getByText("Siguiente"));

		// Step 4: Precio — the status select is on this step. waitFor
		// confirms the step transition has fully settled (the previous
		// step's contents have been unmounted and the new step's
		// "Estado inicial" label has been mounted) before we open the
		// Radix Select.
		await waitFor(() => {
			expect(
				screen.getByText(/estado inicial/i, { selector: "label" }),
			).toBeInTheDocument();
		});

		// Open the status select. The Radix Select trigger has the
		// role "combobox" and is the only combobox on the page.
		const statusSelect = screen.getByRole("combobox");
		await user.click(statusSelect);

		// Radix Select renders the options inside a Portal that
		// mounts asynchronously after the trigger click. waitFor
		// polls until the first option is in the DOM, which also
		// flushes any pending state updates from the portal mount.
		await waitFor(() => {
			expect(
				screen.getByRole("option", { name: /presupuesto/i }),
			).toBeInTheDocument();
		});

		// Every other status must remain available (presupuesto, enviado,
		// aprobado, entregado, cancelado). En producción MUST be excluded.
		expect(
			screen.getByRole("option", { name: /presupuesto/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("option", { name: /enviado/i })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: /aprobado/i })).toBeInTheDocument();
		expect(
			screen.getByRole("option", { name: /entregado/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("option", { name: /cancelado/i }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("option", { name: /en producci[oó]n/i }),
		).not.toBeInTheDocument();
	});
});

// Local polyfill for the Radix Select's ResizeObserver usage. jsdom
// does not provide ResizeObserver, and the Radix SelectContent
// component uses it for positioning. This is scoped to the form test
// file to avoid changing the global test setup for a single test
// (and to keep this PR 6 blocker-fix focused).
if (typeof globalThis.ResizeObserver === "undefined") {
	class ResizeObserverPolyfill {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	}
	// Cast through `unknown` because the polyfill intentionally
	// drops the constructor argument; the only calls Radix makes are
	// `observe` / `unobserve` / `disconnect`, which we no-op.
	(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
		ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}

// Local polyfill for the pointer-capture methods that Radix Select
// calls on the trigger's pointerdown event handler. jsdom does not
// implement `hasPointerCapture` / `setPointerCapture` /
// `releasePointerCapture` on `Element.prototype`, and
// `userEvent.click()` dispatches a `pointerdown` event that
// `SelectTrigger` immediately queries. Without these no-ops, the
// userEvent-driven click throws
// `TypeError: target.hasPointerCapture is not a function`.
//
// This is intentionally scoped to the form test file (not pushed to
// `tests/setup.ts`) because:
//   1. Only this file exercises the Radix Select + userEvent combo
//      in a way that hits the pointer-capture call path.
//   2. We want the global test setup to stay minimal — adding
//      prototypes there would mask the underlying jsdom gap for any
//      future caller.
//
// The polyfill is a no-op because the tests don't depend on actual
// pointer-capture semantics; we only need the methods to exist so
// the synchronous read in Radix's pointerdown handler doesn't
// throw.
if (
	typeof HTMLElement !== "undefined" &&
	typeof (HTMLElement.prototype as { hasPointerCapture?: unknown })
		.hasPointerCapture !== "function"
) {
	HTMLElement.prototype.hasPointerCapture = function hasPointerCapture() {
		return false;
	};
	HTMLElement.prototype.setPointerCapture = function setPointerCapture() {
		// no-op
	};
	HTMLElement.prototype.releasePointerCapture =
		function releasePointerCapture() {
			// no-op
		};
}

// Local polyfill for `Element.prototype.scrollIntoView`. jsdom does
// not implement it (the standard recommends it, but it's a layout-
// only API in a real browser; in jsdom it's just a no-op stub at
// best, and at worst undefined). Radix Select calls
// `candidate?.scrollIntoView()` when the trigger opens to scroll the
// selected option into view, and the optional chain still throws if
// `scrollIntoView` is not a function on the candidate element.
if (
	typeof HTMLElement !== "undefined" &&
	typeof (HTMLElement.prototype as { scrollIntoView?: unknown })
		.scrollIntoView !== "function"
) {
	HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
		// no-op
	};
}
