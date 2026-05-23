import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LandingPage } from "./LandingPage";
import {
	heroCopy,
	navItems,
	features,
	workflowSteps,
	faqs,
	testimonials,
	painPoints,
	beforeItems,
	afterItems,
	comparisonRows,
	comparisonTools,
} from "../data/landingContent";
import { pricingPlan } from "../data/pricing";

describe("LandingPage", () => {
	function setup() {
		render(
			<MemoryRouter>
				<LandingPage />
			</MemoryRouter>,
		);
	}

	it("renders brand name", () => {
		setup();
		expect(screen.getAllByText("CarpinteroPro").length).toBeGreaterThan(0);
	});

	it("renders main hero heading", () => {
		setup();
		expect(
			screen.getByRole("heading", { name: heroCopy.headline }),
		).toBeInTheDocument();
	});

	it("primary CTA links to /login", () => {
		setup();
		const ctas = screen.getAllByRole("link", {
			name: heroCopy.primaryCta.label,
		});
		expect(ctas.length).toBeGreaterThan(0);
		for (const cta of ctas) {
			expect(cta).toHaveAttribute("href", "/login");
		}
	});

	it("footer contains links to /terms and /privacy", () => {
		setup();
		const footer = screen.getByRole("contentinfo");
		expect(
			within(footer)
				.getAllByRole("link", { name: /Términos/i })
				.some((link) => link.getAttribute("href") === "/terms"),
		).toBe(true);
		expect(
			within(footer)
				.getAllByRole("link", { name: /Privacidad/i })
				.some((link) => link.getAttribute("href") === "/privacy"),
		).toBe(true);
	});

	it("anchor navigation items are present", () => {
		setup();
		const nav = screen.getByRole("navigation", {
			name: "Navegación de venta",
		});
		for (const item of navItems) {
			expect(
				within(nav).getByRole("link", { name: item.label }),
			).toHaveAttribute("href", item.href);
		}
	});

	it("renders feature section with prototype copy", () => {
		setup();
		expect(
			screen.getByRole("heading", {
				name: "Todo lo que necesitás para gestionar tu taller",
			}),
		).toBeInTheDocument();
		for (const feature of features) {
			expect(screen.getAllByText(feature.title).length).toBeGreaterThan(0);
			expect(screen.getByText(feature.description)).toBeInTheDocument();
		}
	});

	it("renders workflow section with steps", () => {
		setup();
		expect(
			screen.getByRole("heading", {
				name: "De la idea al presupuesto en 3 pasos",
			}),
		).toBeInTheDocument();
		for (const step of workflowSteps) {
			expect(screen.getByText(step.title)).toBeInTheDocument();
			expect(screen.getByText(step.description)).toBeInTheDocument();
		}
	});

	it("renders pricing section with fixed public price", () => {
		setup();
		expect(
			screen.getByRole("heading", { name: "Una suscripción, todo incluido" }),
		).toBeInTheDocument();
		expect(screen.getByText(pricingPlan.name)).toBeInTheDocument();
		expect(screen.getByText(pricingPlan.price)).toBeInTheDocument();
		for (const feature of pricingPlan.features) {
			expect(screen.getAllByText(feature).length).toBeGreaterThan(0);
		}
	});

	it("pricing CTA links to /login", () => {
		setup();
		const ctas = screen.getAllByRole("link", { name: pricingPlan.ctaLabel });
		expect(ctas.length).toBeGreaterThan(0);
		expect(ctas[ctas.length - 1]).toHaveAttribute("href", "/login");
	});

	it("renders FAQ section with questions and answers", () => {
		setup();
		expect(
			screen.getByRole("heading", { name: "¿Tenés dudas?" }),
		).toBeInTheDocument();
		for (const faq of faqs) {
			expect(screen.getByText(faq.question)).toBeInTheDocument();
			expect(screen.getByText(faq.answer)).toBeInTheDocument();
		}
	});

	it("renders social proof with safe product benefits", () => {
		setup();
		expect(
			screen.getByRole("heading", {
				name: "Lo que CarpinteroPro ordena en tu taller",
			}),
		).toBeInTheDocument();
		for (const t of testimonials) {
			expect(screen.getAllByText(t.name).length).toBeGreaterThan(0);
			expect(screen.getByText(`"${t.quote}"`)).toBeInTheDocument();
		}
	});

	it("renders pain points section", () => {
		setup();
		expect(
			screen.getByRole("heading", {
				name: "Los problemas que todo carpintero conoce",
			}),
		).toBeInTheDocument();
		for (const p of painPoints) {
			expect(screen.getByText(p.question)).toBeInTheDocument();
		}
	});

	it("renders before/after section", () => {
		setup();
		expect(
			screen.getByRole("heading", {
				name: "Antes vs. Después de CarpinteroPro",
			}),
		).toBeInTheDocument();
		const baSection = screen
			.getByRole("heading", {
				name: "Antes vs. Después de CarpinteroPro",
			})
			.closest("section") as HTMLElement;
		for (const b of beforeItems) {
			expect(within(baSection).getByText(b.text)).toBeInTheDocument();
		}
		for (const a of afterItems) {
			expect(within(baSection).getAllByText(a.text).length).toBeGreaterThan(0);
		}
	});

	it("renders comparison table", () => {
		setup();
		expect(
			screen.getByRole("heading", {
				name: "¿Por qué no seguir con lo que ya tengo?",
			}),
		).toBeInTheDocument();
		const compSection = screen
			.getByRole("heading", {
				name: "¿Por qué no seguir con lo que ya tengo?",
			})
			.closest("section") as HTMLElement;
		for (const tool of comparisonTools) {
			expect(within(compSection).getAllByText(tool).length).toBeGreaterThan(0);
		}
		for (const row of comparisonRows) {
			expect(within(compSection).getByText(row.name)).toBeInTheDocument();
		}
	});

	it("has semantic page landmarks", () => {
		setup();
		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(screen.getByRole("main")).toBeInTheDocument();
		expect(screen.getByRole("contentinfo")).toBeInTheDocument();
	});

	it("has exactly one h1 heading", () => {
		setup();
		const h1s = screen.getAllByRole("heading", { level: 1 });
		expect(h1s).toHaveLength(1);
	});

	it("nav anchor links target existing section ids", () => {
		setup();
		for (const item of navItems) {
			if (item.href.startsWith("#")) {
				const sectionId = item.href.slice(1);
				const section = document.getElementById(sectionId);
				expect(section).toBeTruthy();
			}
		}
	});

	it("hero demo visual has accessible dashboard labels", () => {
		setup();
		const visual = screen.getByRole("img", {
			name: /panel del taller/i,
		});
		expect(visual).toBeInTheDocument();
		expect(within(visual).getByText("Facturado"));
		expect(within(visual).getByText("Presupuestos"));
	});

	it("renders and updates the ROI calculator demo", () => {
		setup();
		expect(
			screen.getByRole("heading", {
				name: "¿Cuánto te cuesta NO tener CarpinteroPro?",
			}),
		).toBeInTheDocument();

		const hoursSlider = screen.getByLabelText(
			/Horas\/semana en presupuestos y admin/i,
		);
		fireEvent.change(hoursSlider, { target: { value: "10" } });

		expect(screen.getByText("10hs")).toBeInTheDocument();
		expect(screen.getByText("28hs")).toBeInTheDocument();
	});

	it("renders walkthrough demo and allows manual step changes", () => {
		setup();
		expect(
			screen.getByRole("heading", { name: "Un presupuesto en 4 toques" }),
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /Definí el precio/i }));
		expect(screen.getByText("Aplicá tu margen")).toBeInTheDocument();
		expect(screen.getByText("Precio final")).toBeInTheDocument();
	});

	it("renders inline quote demo and reaches sent state", () => {
		setup();
		expect(
			screen.getByRole("heading", { name: "Creá un presupuesto ahora" }),
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /Juego de sillas/i }));
		fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
		fireEvent.change(screen.getByLabelText(/Margen de ganancia/i), {
			target: { value: "50" },
		});
		fireEvent.click(screen.getByRole("button", { name: /Preparar envío/i }));
		fireEvent.click(
			screen.getByRole("button", { name: /Enviar por WhatsApp/i }),
		);

		expect(screen.getByText("¡Presupuesto enviado!")).toBeInTheDocument();
	});

	it("renders mobile-first phone demo", () => {
		setup();
		expect(
			screen.getByRole("heading", { name: "Tu taller en el bolsillo" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("group", { name: /vista móvil de CarpinteroPro/i }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Inventario" }));
		expect(screen.getByText("Melamina blanca")).toBeInTheDocument();
		expect(screen.getAllByText("PDF listo para enviar").length).toBeGreaterThan(
			0,
		);
	});

	it("FAQ accordion buttons have aria-controls matching panel ids", () => {
		setup();
		for (const faq of faqs) {
			const button = screen.getByRole("button", { name: faq.question });
			const controlsId = button.getAttribute("aria-controls");
			expect(controlsId).toBeTruthy();
			const panel = document.getElementById(controlsId as string);
			expect(panel).toBeInTheDocument();
		}
	});

	describe("reduced motion", () => {
		it("pain points are all visible when reduced motion is preferred", () => {
			const originalMatchMedia = window.matchMedia;
			window.matchMedia = vi.fn().mockImplementation((query: string) => ({
				matches: query === "(prefers-reduced-motion: reduce)",
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})) as unknown as typeof window.matchMedia;

			try {
				render(
					<MemoryRouter>
						<LandingPage />
					</MemoryRouter>,
				);

				const painSection = screen
					.getByRole("heading", {
						name: "Los problemas que todo carpintero conoce",
					})
					.closest("section") as HTMLElement;

				for (const p of painPoints) {
					const card = within(painSection)
						.getByText(p.question)
						.closest("div") as HTMLElement;
					expect(card).not.toHaveClass("opacity-60");
				}
			} finally {
				window.matchMedia = originalMatchMedia;
			}
		});
	});
});
