import { describe, it, expect } from "vitest";
// Vite's `?raw` import returns the file text directly. This test uses
// the same source-level import pattern as the rest of the suite
// instead of Node file-system APIs.
import eslintConfigSource from "../../eslint.config.js?raw";

/**
 * The `featureZone` helper must keep cross-feature imports on the
 * target feature's public barrel (`src/features/<feature>/index.ts`)
 * while still allowing self-imports inside the feature directory.
 * This test pins the config source shape so a broader exception can't
 * slip in unnoticed.
 */

describe("ESLint boundary — featureZone barrel-only contract", () => {
  it("cross-feature exceptions use the barrel file only (`./${name}/index.ts`)", () => {
    const crossFeatureBarrelException =
      /exceptions\.map\(\(name\)\s*=>\s*`\.\/\$\{name\}\/index\.ts`\)/;
    expect(eslintConfigSource).toMatch(crossFeatureBarrelException);
  });

  it("self-imports stay scoped to the feature directory (`./${feature}`)", () => {
    const selfImportDirectoryException = /`\.\/\$\{feature\}`/;
    expect(eslintConfigSource).toMatch(selfImportDirectoryException);
  });

  it("dashboard and quotes both allow the production barrel", () => {
    const dashboardZoneCall =
      /featureZone\(\s*["']dashboard["']\s*,\s*\[\s*["']production["']\s*\]\s*\)/;
    const quotesZoneCall =
      /featureZone\(\s*["']quotes["']\s*,\s*\[\s*["']production["']\s*\]\s*\)/;

		expect(eslintConfigSource).toMatch(dashboardZoneCall);
		expect(eslintConfigSource).toMatch(quotesZoneCall);
	});

  it("the production zone stays strict with no cross-feature exceptions", () => {
    const productionZoneStrictCall =
      /featureZone\(\s*["']production["']\s*(?:,\s*\[\s*\]\s*)?\)/;
    const productionZoneLenientCall =
      /featureZone\(\s*["']production["']\s*,\s*\[\s*["'][a-z]+["']\s*\]/;

		expect(eslintConfigSource).toMatch(productionZoneStrictCall);
		expect(eslintConfigSource).not.toMatch(productionZoneLenientCall);
	});
});
