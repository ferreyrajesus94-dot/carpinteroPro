import { useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import type { StockMovementLedgerFilters as Filters, StockMovementReason } from "../api/stockMovements";

interface StockMovementLedgerFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

const REASONS: { value: StockMovementReason; label: string }[] = [
  { value: "compra", label: "Compra" },
  { value: "consumo", label: "Consumo" },
  { value: "merma", label: "Merma" },
  { value: "ajuste", label: "Ajuste" },
  { value: "descuento_presupuesto", label: "Descuento presupuesto" },
];

export function StockMovementLedgerFilters({
  filters,
  onFiltersChange,
}: StockMovementLedgerFiltersProps) {
  const update = useCallback(
    (partial: Partial<Filters>) => {
      onFiltersChange({ ...filters, ...partial });
    },
    [filters, onFiltersChange],
  );

  const handleReset = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Reason filter */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason-filter" className="text-xs text-ink3">
          Motivo
        </Label>
        <Select
          value={filters.reason ?? "all"}
          onValueChange={(value) =>
            update({ reason: value === "all" ? null : (value as StockMovementReason) })
          }
        >
          <SelectTrigger
            id="reason-filter"
            aria-label="Filtrar por motivo"
            className="w-[180px]"
          >
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {REASONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Material search */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="search-input" className="text-xs text-ink3">
          Material
        </Label>
        <Input
          id="search-input"
          placeholder="Buscar material..."
          value={filters.search ?? ""}
          onChange={(e) => update({ search: e.target.value || null })}
          className="w-[200px]"
        />
      </div>

      {/* Date from */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="from-date" className="text-xs text-ink3">
          Desde
        </Label>
        <Input
          id="from-date"
          type="date"
          value={filters.from ?? ""}
          onChange={(e) =>
            update({ from: e.target.value || null })
          }
          className="w-[150px]"
        />
      </div>

      {/* Date to */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="to-date" className="text-xs text-ink3">
          Hasta
        </Label>
        <Input
          id="to-date"
          type="date"
          value={filters.to ?? ""}
          onChange={(e) =>
            update({ to: e.target.value || null })
          }
          className="w-[150px]"
        />
      </div>

      {/* Reset button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleReset}
        aria-label="Limpiar filtros"
      >
        Limpiar filtros
      </Button>
    </div>
  );
}
