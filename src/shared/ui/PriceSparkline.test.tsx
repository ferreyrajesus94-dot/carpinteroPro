import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriceSparkline, resolveSparklineColor, type SparklinePoint } from "./PriceSparkline";

function makeData(values: number[]): SparklinePoint[] {
  const base = new Date("2026-01-01");
  return values.map((price, i) => ({
    date: new Date(base.getTime() + i * 86400000).toISOString(),
    price,
  }));
}

describe("PriceSparkline", () => {
  it("renders placeholder dash when data has fewer than 2 points", () => {
    const { container } = render(<PriceSparkline data={makeData([100])} />);
    expect(container.textContent).toBe("—");
  });

  it("renders a chart container with up-trend data", () => {
    const data = makeData([100, 110, 105, 120]);
    const { container } = render(
      <PriceSparkline data={data} width={80} height={24} />,
    );
    // In JSDOM, Recharts may not render the SVG (no layout context),
    // but the outer div should be present with the correct dimensions
    const chartDiv = container.firstChild as HTMLElement;
    expect(chartDiv).toBeInTheDocument();
    expect(chartDiv.style.width).toBe("80px");
    expect(chartDiv.style.height).toBe("24px");
  });

  it("renders a chart container with down-trend data", () => {
    const data = makeData([120, 110, 105, 100]);
    const { container } = render(
      <PriceSparkline data={data} width={80} height={24} />,
    );
    const chartDiv = container.firstChild as HTMLElement;
    expect(chartDiv).toBeInTheDocument();
  });

  it("renders a chart container with flat data", () => {
    const data = makeData([100, 100, 100, 100]);
    const { container } = render(
      <PriceSparkline data={data} width={80} height={24} />,
    );
    const chartDiv = container.firstChild as HTMLElement;
    expect(chartDiv).toBeInTheDocument();
  });
});

describe("resolveSparklineColor", () => {
  it("returns chart-down when price goes up (last > first)", () => {
    expect(resolveSparklineColor(100, 120)).toBe("var(--chart-down)");
  });

  it("returns chart-up when price goes down (last < first)", () => {
    expect(resolveSparklineColor(120, 100)).toBe("var(--chart-up)");
  });

  it("returns chart-neutral when price is flat (last === first)", () => {
    expect(resolveSparklineColor(100, 100)).toBe("var(--chart-neutral)");
  });

  it("handles negative values correctly", () => {
    expect(resolveSparklineColor(-100, -90)).toBe("var(--chart-down)");
    expect(resolveSparklineColor(-90, -100)).toBe("var(--chart-up)");
    expect(resolveSparklineColor(-100, -100)).toBe("var(--chart-neutral)");
  });

  it("always returns one of the three expected CSS variables", () => {
    const cases = [
      [0, 1], [0, -1], [100, 200], [200, 100],
      [50, 50], [-5, -5], [1.5, 2.5], [1000, 999],
    ];
    const valid = ["var(--chart-up)", "var(--chart-down)", "var(--chart-neutral)"];
    for (const [a, b] of cases) {
      expect(valid).toContain(resolveSparklineColor(a, b));
    }
  });
});
