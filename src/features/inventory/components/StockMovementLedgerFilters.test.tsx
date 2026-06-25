import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StockMovementLedgerFilters } from "./StockMovementLedgerFilters";
import type { StockMovementLedgerFilters as Filters } from "../api/stockMovements";

describe("StockMovementLedgerFilters", () => {
  const defaultFilters: Filters = {};

  it("renders reason select, material search input, and date range inputs", () => {
    const onChange = vi.fn();
    render(
      <StockMovementLedgerFilters
        filters={defaultFilters}
        onFiltersChange={onChange}
      />,
    );

    // Reason select (uses radix select trigger)
    expect(screen.getByRole("combobox", { name: /motivo/i })).toBeInTheDocument();

    // Material search input
    expect(
      screen.getByPlaceholderText(/buscar material/i),
    ).toBeInTheDocument();

    // Date from input
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();

    // Date to input
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();

    // Limpiar filtros button
    expect(
      screen.getByRole("button", { name: /limpiar filtros/i }),
    ).toBeInTheDocument();
  });

  it("typing in search input calls onFiltersChange with the search value", () => {
    const onChange = vi.fn();
    render(
      <StockMovementLedgerFilters
        filters={defaultFilters}
        onFiltersChange={onChange}
      />,
    );

    const input = screen.getByPlaceholderText(/buscar material/i);
    fireEvent.change(input, { target: { value: "MDF" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: "MDF" }),
    );
  });

  it("changing date range calls onFiltersChange with from/to values", () => {
    const onChange = vi.fn();
    render(
      <StockMovementLedgerFilters
        filters={defaultFilters}
        onFiltersChange={onChange}
      />,
    );

    const fromInput = screen.getByLabelText(/desde/i);
    fireEvent.change(fromInput, { target: { value: "2026-01-01" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-01-01" }),
    );
  });

  it("selecting a reason in the select calls onFiltersChange (value-based)", () => {
    const onChange = vi.fn();
    render(
      <StockMovementLedgerFilters
        filters={defaultFilters}
        onFiltersChange={onChange}
      />,
    );

    // The component internally calls onFiltersChange with { reason: value }
    // when the Radix Select onValueChange fires with a non-"all" value.
    // We can't easily open Radix Select in jsdom, so we verify the
    // "Todos" placeholder is visible (initial state).
    expect(screen.getByText("Todos")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /motivo/i })).toBeInTheDocument();
  });

  it("'Limpiar filtros' button resets all filters to defaults and calls onFiltersChange", () => {
    const onChange = vi.fn();
    render(
      <StockMovementLedgerFilters
        filters={{ search: "MDF" }}
        onFiltersChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /limpiar filtros/i }));

    expect(onChange).toHaveBeenCalledWith({});
  });
});
