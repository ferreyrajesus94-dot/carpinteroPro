import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorState, EmptyState, LoadingState } from "./feedback-state";

describe("ErrorState", () => {
  it("renders title and description with aria-live region", () => {
    render(<ErrorState title="Algo salió mal" description="Intentalo de nuevo" />);

    const region = screen.getByRole("alert");
    expect(region).toHaveTextContent("Algo salió mal");
    expect(region).toHaveTextContent("Intentalo de nuevo");
  });

  it("renders an action button when provided", () => {
    render(
      <ErrorState
        title="Error"
        action={<button type="button">Reintentar</button>}
      />,
    );

    expect(
      screen.getByRole("button", { name: /reintentar/i }),
    ).toBeInTheDocument();
  });

  it("renders without description or action", () => {
    render(<ErrorState title="Algo salió mal" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Algo salió mal");
  });
});

describe("EmptyState", () => {
  it('renders no-results variant with icon and title', () => {
    render(<EmptyState variant="no-results" title="Sin resultados" />);

    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.getByText("No encontramos resultados para tu búsqueda.")).toBeInTheDocument();
  });

  it('renders empty-feature variant with custom description', () => {
    render(
      <EmptyState
        variant="empty-feature"
        title="No hay elementos"
        description="Agregá tu primer elemento."
      />,
    );

    expect(screen.getByText("No hay elementos")).toBeInTheDocument();
    expect(screen.getByText("Agregá tu primer elemento.")).toBeInTheDocument();
  });

  it('renders unavailable variant', () => {
    render(<EmptyState variant="unavailable" title="No disponible" />);

    expect(screen.getByText("No disponible")).toBeInTheDocument();
    expect(
      screen.getByText("Esta sección no está disponible en este momento."),
    ).toBeInTheDocument();
  });

  it('renders an action element when provided', () => {
    render(
      <EmptyState
        variant="empty-feature"
        title="Vacío"
        action={<button type="button">Crear</button>}
      />,
    );

    expect(screen.getByRole("button", { name: /crear/i })).toBeInTheDocument();
  });
});

describe("LoadingState", () => {
  it("renders spinner with role='status' and aria-busy='true'", () => {
    render(<LoadingState />);

    const spinner = screen.getByRole("status");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute("aria-busy", "true");
  });

  it("renders with a custom label", () => {
    render(<LoadingState label="Cargando presupuestos..." />);

    expect(screen.getByText("Cargando presupuestos...")).toBeInTheDocument();
  });
});
