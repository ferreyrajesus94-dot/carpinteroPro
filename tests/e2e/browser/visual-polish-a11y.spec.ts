import { expect, test } from "@playwright/test";

test.describe("Visual system polish: focus & reduced-motion guards", () => {
	test("focus-ring: sidebar NavLink receives visible focus-visible outline",
		{ tag: ["@a11y", "@focus-ring", "@VISUAL-POLISH-001"] },
		async ({ page }) => {
			await page.goto("/dashboard");
			await page.waitForLoadState("networkidle");

			// Tab to first focusable element (sidebar "Inicio" NavLink)
			await page.keyboard.press("Tab");

			const focused = page.locator(":focus");
			await expect(focused).toBeVisible();

			// The focused element must carry the focus-ring class
			await expect(focused).toHaveClass(/focus-ring/);

			// The focus-ring:focus-visible CSS rule must produce a visible outline
			const outlineWidth = await focused.evaluate(
				(el) => window.getComputedStyle(el).outlineWidth,
			);
			expect(parseFloat(outlineWidth)).toBeGreaterThan(0);
		},
	);

	test("focus: PageHeader action period buttons are keyboard-reachable",
		{ tag: ["@a11y", "@focus", "@VISUAL-POLISH-002"] },
		async ({ page }) => {
			await page.goto("/dashboard");
			await page.waitForLoadState("networkidle");

			// Dashboard PageHeader renders period-selector buttons in actions slot
			const periodButton = page.getByRole("button", { name: "Mes actual" });
			await expect(periodButton).toBeVisible();
			await periodButton.focus();
			await expect(periodButton).toBeFocused();

			// Verify keyboard reachability: tab from one button to the next
			await page.keyboard.press("Tab");
			const nextFocused = page.locator(":focus");
			// After "Mes actual", Tab should move to "Mes anterior"
			await expect(nextFocused).toHaveText("Mes anterior");
		},
	);

	test("reduced-motion: animate-pulse / animate-spin suppressed under prefers-reduced-motion",
		{ tag: ["@a11y", "@reduced-motion", "@VISUAL-POLISH-003"] },
		async ({ page }) => {
			await page.emulateMedia({ reducedMotion: "reduce" });
			await page.goto("/dashboard");
			await page.waitForLoadState("networkidle");

			// Strategy: look for real .animate-pulse / .animate-spin elements.
			// With local mocks, data resolves before paint, so loading skeletons
			// may not appear. If none found, inject a test element to verify
			// the CSS contract applies.

			const animatedSelector = ".animate-pulse, .animate-spin, .animate-bounce";
			const realCount = await page.evaluate((sel: string) => {
				return document.querySelectorAll(sel).length;
			}, animatedSelector);

			if (realCount > 0) {
				// Real elements exist — assert each one has animation suppressed
				const allNone = await page.evaluate((sel: string) => {
					const els = document.querySelectorAll(sel);
					return Array.from(els).every(
						(el) => window.getComputedStyle(el).animationName === "none",
					);
				}, animatedSelector);
				expect(allNone).toBe(true);
			} else {
				// No real animated elements rendered — still verify the CSS rule
				// by creating a test element. The test fails if the page context
				// is broken or the CSS bundle is missing the guard.
				const animName = await page.evaluate(() => {
					const el = document.createElement("div");
					el.className = "animate-pulse";
					document.body.appendChild(el);
					const name = window.getComputedStyle(el).animationName;
					el.remove();
					return name;
				});
				expect(animName).toBe("none");
			}

			// Additionally verify that the reduced-motion CSS guard was
			// injected by Vite. Search all <style> tags for the guard text.
			const guardInjected = await page.evaluate(() => {
				const styles = document.querySelectorAll("style");
				return Array.from(styles).some((tag) => {
					const t = (tag.textContent ?? "").replace(/\s/g, "");
					return t.includes("reduced-motion") && t.includes("animation:none");
				});
			});
			expect(guardInjected).toBe(true);
		},
	);
});
