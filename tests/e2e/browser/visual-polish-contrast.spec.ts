import { test, expect } from "@playwright/test";

/**
 * WCAG contrast check using real rendered colors from the page.
 *
 * Approach: inject a pair of <span> elements with the target token classes,
 * read the browser-computed color and background-color, and compute the
 * WCAG 2.2 contrast ratio from the resolved sRGB hex values using the
 * browser's own Canvas 2D pixel manipulation.
 *
 * This avoids all oklch → hex conversion issues because the browser
 * resolves the oklch() token to its actual rendered sRGB value.
 */

/**
 * Shared contrast checker factory — runs inside page.evaluate().
 * Returns an object with pair results: name, fg, bg, ratio, threshold.
 */
function createContrastChecker() {
	return () => {
		function cssToHex(cssColor: string): string {
			const canvas = document.createElement("canvas");
			canvas.width = 1;
			canvas.height = 1;
			const ctx = canvas.getContext("2d")!;
			ctx.fillStyle = cssColor;
			ctx.fillRect(0, 0, 1, 1);
			const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
			const toHex = (v: number) => v.toString(16).padStart(2, "0");
			return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
		}

		const bodyBg = cssToHex(getComputedStyle(document.body).backgroundColor);

		function fgOnBg(tokenClass: string): { fg: string; bg: string } {
			const span = document.createElement("span");
			span.className = tokenClass;
			span.textContent = "Hg";
			document.body.appendChild(span);
			const fg = cssToHex(getComputedStyle(span).color);
			document.body.removeChild(span);
			return { fg, bg: bodyBg };
		}

		function fgOnBg2(tokenClass: string): { fg: string; bg: string } {
			return fgOnElementBg(tokenClass, "bg-cp-bg2");
		}

		function fgOnSurface(tokenClass: string): { fg: string; bg: string } {
			return fgOnElementBg(tokenClass, "bg-cp-surface");
		}

		function fgOnElementBg(
			tokenClass: string,
			bgClass: string,
		): { fg: string; bg: string } {
			const wrapper = document.createElement("div");
			wrapper.className = bgClass;
			wrapper.style.padding = "1px";
			document.body.appendChild(wrapper);

			const span = document.createElement("span");
			span.className = tokenClass;
			span.textContent = "Hg";
			wrapper.appendChild(span);

			const fg = cssToHex(getComputedStyle(span).color);
			const bg = cssToHex(getComputedStyle(wrapper).backgroundColor);
			document.body.removeChild(wrapper);
			return { fg, bg };
		}

		function luminance(hex: string): number {
			const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
			const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
			const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
			const lin = (c: number) =>
				c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
			return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
		}

		function ratio(l1: number, l2: number): number {
			return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
		}

		const inkOnBg = fgOnBg("text-ink");
		const ink2OnBg = fgOnBg("text-ink2");
		const ink2OnSurface = fgOnSurface("text-ink2");
		const ink2OnBg2 = fgOnBg2("text-ink2");
		const inkOnBg2 = fgOnBg2("text-ink");
		const ink3OnBg = fgOnBg("text-ink3");

		return {
			pairs: [
				{
					name: "ink on bg",
					fg: inkOnBg.fg,
					bg: inkOnBg.bg,
					ratio: ratio(luminance(inkOnBg.fg), luminance(inkOnBg.bg)),
					threshold: 4.5,
				},
				{
					name: "ink2 on bg",
					fg: ink2OnBg.fg,
					bg: ink2OnBg.bg,
					ratio: ratio(luminance(ink2OnBg.fg), luminance(ink2OnBg.bg)),
					threshold: 4.5,
				},
				{
					name: "ink2 on surface",
					fg: ink2OnSurface.fg,
					bg: ink2OnSurface.bg,
					ratio: ratio(luminance(ink2OnSurface.fg), luminance(ink2OnSurface.bg)),
					threshold: 4.5,
				},
				{
					name: "ink2 on bg2",
					fg: ink2OnBg2.fg,
					bg: ink2OnBg2.bg,
					ratio: ratio(luminance(ink2OnBg2.fg), luminance(ink2OnBg2.bg)),
					threshold: 4.5,
				},
				{
					name: "ink on bg2",
					fg: inkOnBg2.fg,
					bg: inkOnBg2.bg,
					ratio: ratio(luminance(inkOnBg2.fg), luminance(inkOnBg2.bg)),
					threshold: 4.5,
				},
				{
					name: "ink3 on bg",
					fg: ink3OnBg.fg,
					bg: ink3OnBg.bg,
					ratio: ratio(luminance(ink3OnBg.fg), luminance(ink3OnBg.bg)),
					threshold: 3.0,
				},
			],
		};
	};
}

const THEMES = [
	{ name: "sawdust", className: "theme-sawdust" },
	{ name: "workshop", className: "theme-workshop" },
	{ name: "graphite", className: "theme-graphite" },
] as const;

const MODES = ["light", "dark"] as const;

test.describe("Visual polish: WCAG contrast check", () => {
	for (const theme of THEMES) {
		for (const mode of MODES) {
			test(`${theme.name} ${mode}: text-on-bg contrast meets WCAG AA`,
				{ tag: ["@a11y", "@contrast"] },
				async ({ page }) => {
					await page.goto("/dashboard");
					await page.waitForLoadState("networkidle");

					// Reset all theme/dark classes, then apply the target combination
					await page.evaluate(
						({ themeCls, isDark }: { themeCls: string; isDark: boolean }) => {
							const html = document.documentElement;
							html.classList.remove(
								"theme-sawdust",
								"theme-workshop",
								"theme-graphite",
								"dark",
							);
							html.classList.add(themeCls);
							if (isDark) html.classList.add("dark");
						},
						{ themeCls: theme.className, isDark: mode === "dark" },
					);

					await page.waitForTimeout(500);

					const results = await page.evaluate(createContrastChecker());

					for (const pair of results.pairs) {
						expect(
							pair.ratio,
							`${theme.name} ${mode} — ${pair.name}: ${pair.fg} on ${pair.bg} = ${pair.ratio.toFixed(2)}:1 (need ≥${pair.threshold})`,
						).toBeGreaterThanOrEqual(pair.threshold);
					}
				},
			);
		}
	}
});
