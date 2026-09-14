# Portfolio screenshot capture plan

Capture these screenshots after deploying to a hosted environment (Vercel preview or production). Each section below describes the spec file, the assertion that proves the captured state, and the command to drive it. The seven placeholder SVGs already shipped under `public/screenshots/` are intentional, well-formed stand-ins: they render in the README's screenshot grid and carry a `<title>` + visible caption that names the assertion the eventual PNG must satisfy. Replace them with real PNGs by following the per-screenshot recipe below.

The screenshots are not generated automatically by the spec files in this commit. There are two acceptable paths to produce each PNG:

- **(a) Run the journey locally and capture manually** — start `npm run dev`, follow the spec flow by hand, and paste a screenshot into `public/screenshots/0X-name.png`.
- **(b) Extend the spec with a screenshot step** — insert `await page.screenshot({ path: 'public/screenshots/0X-name.png', fullPage: true });` immediately before the assertion. The five-line snippet at the end of each section shows the placement.

After replacing the SVGs with PNGs (or renaming them to `.png`), re-run `npm run build` so the PWA precache picks up the new assets — see **Post-capture cleanup** at the bottom.

---

## 01 — Signup

- **Placeholder:** `public/screenshots/01-signup.svg`
- **Spec file:** `tests/e2e/browser/signup-journey.spec.ts`
- **`test.describe` block:** `synthetic signup journey`
- **Test:** `a freshly-created user logs in and reaches the free dashboard`
- **Assertion that proves the captured state** (quoted from the spec, `signup-journey.spec.ts:50-58`):
  ```ts
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
      page.getByRole("heading", { name: "Inicio" }),
  ).toBeVisible();
  ```
- **Playwright command:**
  ```bash
  npx playwright test \
      --grep "synthetic signup journey" \
      --project=chromium \
      tests/e2e/browser/signup-journey.spec.ts
  ```
- **How to add a screenshot step** — insert these five lines immediately before the `await expect(page).toHaveURL(/\/dashboard/);` assertion:
  ```ts
  await page.waitForURL(/\/dashboard/);
  await page.getByRole("heading", { name: "Inicio" }).waitFor();
  await page.screenshot({
      path: "public/screenshots/01-signup.png",
      fullPage: true,
  });
  ```

---

## 02 — Onboarding

- **Placeholder:** `public/screenshots/02-onboarding.svg`
- **Spec file:** `tests/e2e/browser/free-journey.spec.ts`
- **`test.describe` block:** `synthetic free journey`
- **Test:** `login → onboarding → inventory → quote → contract/PDF → production`
- **Assertion that proves the captured state** (quoted from the spec, `free-journey.spec.ts:75-83`):
  ```ts
  await page.waitForURL(/\/onboarding/);
  await page.getByRole("button", { name: "Saltar" }).first().click();
  const skipRemaining = page.getByRole("button", { name: "Saltar" });
  const remainingCount = await skipRemaining.count();
  if (remainingCount > 1) {
      await skipRemaining.last().click();
  }
  await expect(page).toHaveURL(/\/dashboard/);
  ```
  Capture **before** clicking `Saltar` so the wizard's step-1 form (`finishTarget` is set to `/dashboard`) is on screen.
- **Playwright command:**
  ```bash
  npx playwright test \
      --grep "synthetic free journey" \
      --project=chromium \
      tests/e2e/browser/free-journey.spec.ts
  ```
- **How to add a screenshot step** — insert these five lines immediately after the `await page.waitForURL(/\/onboarding/);` line and before the first `Saltar` click:
  ```ts
  await page.waitForURL(/\/onboarding/);
  await page.screenshot({
      path: "public/screenshots/02-onboarding.png",
      fullPage: true,
  });
  await page.getByRole("button", { name: "Saltar" }).first().click();
  ```

---

## 03 — Inventory

- **Placeholder:** `public/screenshots/03-inventory.svg`
- **Spec file:** `tests/e2e/browser/free-journey.spec.ts`
- **`test.describe` block:** `synthetic free journey`
- **Test:** `login → onboarding → inventory → quote → contract/PDF → production`
- **Assertion that proves the captured state** (quoted from the spec, `free-journey.spec.ts:121-129`):
  ```ts
  await page.goto("/inventory");
  await expect(
      page.getByRole("heading", { name: "Inventario" }),
  ).toBeVisible();
  await expect(
      page.getByRole("row").filter({
          hasText: `E2E Free Material ${stampSuffix}`,
      }),
  ).toBeVisible();
  ```
  Capture **after** the `Inventario` heading is visible so the seeded `E2E Free Material` row from `useMaterials` is rendered.
- **Playwright command:**
  ```bash
  npx playwright test \
      --grep "synthetic free journey" \
      --project=chromium \
      tests/e2e/browser/free-journey.spec.ts
  ```
- **How to add a screenshot step** — insert these five lines immediately after the `Inventario` heading assertion and before the row assertion:
  ```ts
  await expect(
      page.getByRole("heading", { name: "Inventario" }),
  ).toBeVisible();
  await page.screenshot({
      path: "public/screenshots/03-inventory.png",
      fullPage: true,
  });
  ```

---

## 04 — Quote wizard

- **Placeholder:** `public/screenshots/04-quote-wizard.svg`
- **Spec file:** `tests/e2e/browser/free-journey.spec.ts`
- **`test.describe` block:** `synthetic free journey`
- **Test:** `login → onboarding → inventory → quote → contract/PDF → production`
- **Assertion that proves the captured state** (quoted from the spec, `free-journey.spec.ts:140-152`):
  ```ts
  await page
      .getByRole("button", {
          name: new RegExp(`E2E Free Client ${stampSuffix}`),
      })
      .click();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page
      .getByRole("button", {
          name: new RegExp(`E2E Free Mueble ${stampSuffix}`),
      })
      .click();
  await expect(page.getByLabel("Costo base ($)")).toHaveValue("220");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Crear" }).click();
  ```
  Capture **after** the second `Siguiente` click so the wizard is on step 3 with the client + recipe selected and the `Crear` CTA enabled.
- **Playwright command:**
  ```bash
  npx playwright test \
      --grep "synthetic free journey" \
      --project=chromium \
      tests/e2e/browser/free-journey.spec.ts
  ```
- **How to add a screenshot step** — insert these five lines immediately after the second `Siguiente` click and before the `Crear` click:
  ```ts
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.screenshot({
      path: "public/screenshots/04-quote-wizard.png",
      fullPage: true,
  });
  await page.getByRole("button", { name: "Crear" }).click();
  ```

---

## 05 — Contract PDF

- **Placeholder:** `public/screenshots/05-contract-pdf.svg`
- **Spec file:** `tests/e2e/browser/contract-pdf.spec.ts`
- **`test.describe` block:** `contract and PDF browser surface`
- **Test:** `renders contract data and starts PDF download`
- **Assertion that proves the captured state** (quoted from the spec, `contract-pdf.spec.ts:24-37`):
  ```ts
  await page.goto(`/quotes/${fixture.quoteId}/contract`);
  await expect(
      page.getByRole("heading", {
          name: `Contrato — ${fixture.quoteNumber}`,
      }),
  ).toBeVisible();
  await expect(page.getByText("SDD 7 Cliente Presupuesto")).toBeVisible();
  await expect(page.getByText("SDD 7 Mesa Operativa")).toBeVisible();
  await expect(page.getByText(/481/)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
      `presupuesto-${fixture.quoteNumber}.pdf`,
  );
  ```
  Capture **after** the `Contrato — …` heading is visible and **before** the `Descargar PDF` click. The `waitForEvent("download")` hook is the runtime proof that the filename starts with `presupuesto-`.
- **Playwright command:**
  ```bash
  npx playwright test \
      --grep "contract and PDF browser surface" \
      --project=chromium \
      tests/e2e/browser/contract-pdf.spec.ts
  ```
- **How to add a screenshot step** — insert these five lines immediately before the `waitForEvent("download")` hook:
  ```ts
  await expect(
      page.getByRole("heading", {
          name: `Contrato — ${fixture.quoteNumber}`,
      }),
  ).toBeVisible();
  await page.screenshot({
      path: "public/screenshots/05-contract-pdf.png",
      fullPage: true,
  });
  const downloadPromise = page.waitForEvent("download");
  ```

---

## 06 — Production

- **Placeholder:** `public/screenshots/06-production.svg`
- **Spec file:** `tests/e2e/browser/free-journey.spec.ts`
- **`test.describe` block:** `synthetic free journey`
- **Test:** `login → onboarding → inventory → quote → contract/PDF → production`
- **Assertion that proves the captured state** (quoted from the spec, `free-journey.spec.ts:193-204`):
  ```ts
  await startDialog.getByLabel("Número de orden").fill(productionNumber);
  await startDialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(startDialog).toBeHidden();

  // 11. The new order appears on the production board in the
  //     Planificado column. The board then loads it as
  //     `in_progress` once the kanban / detail page is opened.
  await expect(
      page
          .getByRole("region", { name: "Planificado" })
          .locator("article", { hasText: productionNumber }),
  ).toBeVisible();
  ```
  Capture **after** `await expect(startDialog).toBeHidden()` and **before** the `Planificado` column assertion so the new order is rendered in the board.
- **Playwright command:**
  ```bash
  npx playwright test \
      --grep "synthetic free journey" \
      --project=chromium \
      tests/e2e/browser/free-journey.spec.ts
  ```
- **How to add a screenshot step** — insert these five lines immediately after `await expect(startDialog).toBeHidden();` and before the `Planificado` assertion:
  ```ts
  await expect(startDialog).toBeHidden();
  await page.screenshot({
      path: "public/screenshots/06-production.png",
      fullPage: true,
  });
  await expect(
      page.getByRole("region", { name: "Planificado" })
          .locator("article", { hasText: productionNumber }),
  ).toBeVisible();
  ```

---

## 07 — Settings

- **Placeholder:** `public/screenshots/07-settings.svg`
- **Spec file:** `tests/e2e/browser/billing-gate-blocked.spec.ts`
- **`test.describe` block:** `billing gate removed — historical rows do not block free access`
- **Test:** `user with cancelled historical row still reaches the free dashboard` (or any of the three sibling tests — they all land on the same free dashboard)
- **Assertion that proves the captured state** (quoted from the spec, `billing-gate-blocked.spec.ts:81-100`):
  ```ts
  await seedActiveTrialFixture();
  await mutateFixtureSubscriptionStatus("cancelled");

  await login(page);

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
      page.getByRole("heading", { name: "Inicio" }),
  ).toBeVisible();
  await expect(
      page.getByRole("text", "Suscripción cancelada", { exact: true }),
  ).toHaveCount(0);
  ```
  After landing on `/dashboard`, navigate to `/settings` and assert the `BillingSettingsCard` copy. The `Sin suscripción activa` text is rendered by `BillingSettingsCard` when `subscription={null}` is passed (`src/features/billing/components/BillingSettingsCard.tsx:54-66`).
- **Playwright command:**
  ```bash
  npx playwright test \
      --grep "billing gate removed" \
      --project=chromium \
      tests/e2e/browser/billing-gate-blocked.spec.ts
  ```
- **How to add a screenshot step** — extend the test (or add a sibling test) to navigate to `/settings` and capture the card. Insert these five lines immediately before the `Sin suscripción activa` assertion:
  ```ts
  await page.goto("/settings");
  await expect(
      page.getByTestId("billing-settings-card"),
  ).toBeVisible();
  await page.screenshot({
      path: "public/screenshots/07-settings.png",
      fullPage: true,
  });
  await expect(
      page.getByTestId("billing-no-subscription"),
  ).toBeVisible();
  ```

---

## Post-capture cleanup

1. **Replace the SVGs.** Either delete `public/screenshots/*.svg` and commit the new PNGs, or keep both as a fallback. The README's screenshot grid at `README.md:23-29` references the seven filenames (`01-signup` … `07-settings`); the extension change (`.svg` → `.png`) is transparent to the markdown image syntax, but the README text says "see `docs/portfolio/README.md` in a follow-up commit" — flip that to a one-line description of each screen once the PNGs land.
2. **Rebuild the PWA precache.** Re-run `npm run build` so the workbox manifest in `dist/precache-manifest.*.js` picks up the new assets. The SVG placeholders weigh ~6 KB combined; the seven PNGs are expected to weigh ~50-150 KB each, so the precache size will grow proportionally. Confirm with `ls dist/assets/precache-manifest.*.js && grep -c screenshots dist/assets/precache-manifest.*.js` (must be `7`).
3. **Smoke-check the grid locally.** `npm run dev` and visit `/` — the screenshot grid at `README.md:23-29` resolves to `<img src="/screenshots/0X-name.svg">` (or `.png`); each tile must load without a 404.
4. **Update the audit.** `docs/operations/production-readiness-audit-2026-09-13.md` carries the W6 phase-3 completion record below. The next phase (phase 4) appends a cumulative W6 entry — flag the screenshot row as **shipped (locally, not committed)** when the PNGs land.
