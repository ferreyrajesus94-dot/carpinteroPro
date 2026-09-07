---
version: 1
slug: "src-features-dashboard"
primary_target: "src/features/dashboard"
related_targets: ["src/features/inventory","src/features/quotes","src/features/production","src/features/recipes","src/features/crm","src/features/settings","src/features/landing","src/features/onboarding","src/features/auth"]
---

# Surface brief — Dashboard (`/dashboard`)

**Target:** `src/features/dashboard/` (the home surface for the solo carpenter after login).
**Visitor mode:** Operate. The carpenter lands here to see the day's numbers and act on what needs attention.
**Seed key:** `be7f6d3b` (concept-seed, scope direction, mode operate, re-roll 1).
**Related surfaces:** `src/features/inventory/`, `src/features/quotes/`, `src/features/production/`, `src/features/recipes/`, `src/features/crm/`, `src/features/settings/`, `src/features/landing/`, `src/features/onboarding/`, `src/features/auth/`. The brand brief is defined here; every other surface inherits.

## Audience, job, action, proof, constraints

- **Audience:** solo workshop owner, Spanish Rioplatense voseo, dusty tablet in the workshop, 6-10 hours/day. PRODUCT.md binding.
- **Job:** open the app, see the three numbers the carpenter re-checks all day (revenue, margin, approval status), and act on the day's "requiere atención" items.
- **Action:** glance → confirm "todo en orden" → drill into one section (presupuestos / inventario / producción) or close. The dashboard is the entry point, not the destination.
- **Proof:** the day's revenue figure in display italic, the active production state highlighted in copper-warm-now-nogal, the "requiere atención" block naming actual materials in plain Spanish. No invented claims, no aspirational copy.
- **Constraints:** WCAG 2.1 AA; Spanish Rioplatense voseo only; OKLCH source of truth (per the existing `Single Source Rule`); `Money Is Mono` rule survives (JetBrains Mono + `tnum` on every monetary value); `h-10` minimum touch target survives; feature-sliced architecture; AGPL-3.0 license.

## Chosen direction and memorable moment

- **Mundo:** "El Banco del Carpintero" (renombre del North Star; antes "El Cuaderno del Taller"). Botanical folio como sistema base, levantado con dos donors: "plancha de ebanista" (lino + nogal en lugar de crema + verde) y "bitácora de jornada" (state-to-state como día-a-día, 5 planchas = 5 etapas del taller: rollo → cepillado → armado → terminado → entregado).
- **Memorable moment:** el carpintero abre `/dashboard` y, sin leer una sola palabra, ve lino bajo sus manos. La página dice "taller" antes de que la primera línea de copy aparezca. El primer número que ve (el hero KPI) está en itálica grabada cobre-cobrizo, no en cobre.

## Unresolved decisions (deferred to build-time)

- **Tipografía display exacta:** Fraunces vs Crimson vs Newsreader. Decide en build; cualquier cara de las tres satisface el contrato.
- **Acento primario en light mode:** nogal oscuro (`oklch(35% 0.04 50)`) es el default. Wenge y tintes naturales (índigo, azafrán) son secondaries que no entran como acento principal — el contrato `One Voice Rule` se mantiene.
- **Landing page:** la landing se rediseña con la misma identidad pero como segunda fase. En esta pasada, solo se actualizan los tokens para que la landing herede OKLCH correcto, no se rediseña la composición.
- **Dark mode:** nogal pulido sobre fondo cuero teñido (no el dark cobrizo actual). Decisión se valida durante el build con un screenshot real.

## Direction contract

```markdown
## Direction contract

THESIS: Abandonamos el cobre (herramienta de developer), entramos al oficio. Lino crudo, nogal oscuro, itálica grabada. La materialidad es estructural, no cosmética.

OWN-WORLD: Lino (oklch 95% 0.012 80) como ground light; nogal oscuro (oklch 35% 0.04 50) como único acento; escarlata-a-negro como transición de estado (maduración → advertencia → error). Display: itálica grabada tipo Fraunces o Crimson, peso 600, tracking -0.01em. Inter cuerpo. JetBrains Mono para números con tnum. Bordes hairline 1px en sepia. Sin sombras. Sin gradientes. Sin segundo acento.

STORY: El carpintero reconoce la herramienta como del taller antes de leer nada. La materialidad dice "oficio" en silencio.

FIRST VIEWPORT: Shell se mantiene (sidebar desktop / bottom-tabs mobile / FAB contextual — son correctos y se preservan). Fondo lino. Acento nogal en botón primario, foco visible, FAB, nav activo, badge de notificación, swatch del estado de producción activo. Header con PageHeader en display itálica grabada sobre hairline sepia. Números en monospace tabular (Money Is Mono se preserva). El hero KPI pasa de cobre-on-paper a nogal-on-lino.

FORM: Asignado index 4 de `concept-seed be7f6d3b` (botanical folio, `editorial-sequence-montage-botanical-folio-season`). Levanto con dos donors nombrados: "plancha de ebanista" (lino + nogal en lugar de crema + verde) y "bitácora de jornada" (estado-a-estado como día-a-día, las 5 planchas de un ciclo botánico se traducen a las 5 etapas del taller: rollo → cepillado → armado → terminado → entregado).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
```

## Untouchable

- `PRODUCT.md` binding constraints (Spanish, WCAG 2.1 AA, solo owner-operator, AGPL-3.0, etc.) — apply, do not edit.
- The seven existing `DESIGN.md` named rules (One Voice, Single Source, No Color-Only State, Money Is Mono, Two-Voice, Flat-By-Default, Backdrop-Blur Surface). They survive the new world. `Money Is Mono` and `One Voice` are explicit anchors; the others apply but the material flips (lino replaces papel cálido, nogal replaces cobre).
- Feature-sliced architecture, Supabase schema, ESLint rule from the prior pass.
- Existing tests (8 dashboard + 15 production = 23). All must still pass after the redesign; if a test asserts cobre-specific behavior, it gets rewritten with the new tokens, not deleted.
- AGPL-3.0 license headers and contributor process (issue-first, branch prefix, Conventional Commits).
