# SDD8 WU5 — Core Coupling Follow-up Decision

## Decision

Defer quotes/CRM/recipes/inventory decoupling to a separate SDD change. SDD8 records the target direction only; it does not change production code for this coupling area.

## Rationale

The remaining coupling is domain-heavy and bidirectional:

- `crm → quotes`
- `quotes → crm`
- `quotes → recipes`
- `quotes → settings`
- `recipes → inventory`
- `recipes → settings`

Mechanically removing these imports inside SDD8 would risk behavior changes in quote creation, CRM history, recipe costing, contract rendering, and settings-driven calculations. It would also create an oversized review diff after WU1–WU4 already consumed the safe architecture-cleanup slices.

## Rejected approaches for SDD8

- **Event bus:** rejected because it adds runtime behavior and failure modes without a product need.
- **Shared global state:** rejected because it hides coupling instead of clarifying ownership.
- **Feature-to-feature public API loophole:** rejected because feature `index.ts` exports are for app-level composition, not for bypassing feature isolation.
- **All-at-once decoupling:** rejected because it would exceed the review budget and mix domain decisions with mechanical cleanup.

## Recommended follow-up SDD

Create a separate architecture change for core workflow coupling. That change should choose one of these approaches per workflow:

1. **App-level orchestration using feature public APIs** for page/workflow composition.
2. **Shared domain contracts** for stable snapshots such as client, quote, material, recipe, and settings read models.
3. **Dedicated workflow modules** for cross-domain operations such as quote creation, recipe costing, and contract preview generation.

The follow-up should start with exploration of actual dependency direction and behavior ownership before implementation.

## Remaining ESLint exceptions

The follow-up SDD must resolve these temporary exceptions in `eslint.config.js`:

- `crm → quotes`
- `quotes → crm`
- `quotes → recipes`
- `quotes → settings`
- `recipes → inventory`
- `recipes → settings`

Each exception is intentionally narrow and documented as an SDD8 temporary exception to remove after WU5/follow-up completion.

## Acceptance for this WU

- This decision document exists under the SDD8 change.
- No production, test, lint, package, or app code changes are made for WU5.
- Remaining exceptions are explicitly listed for a future SDD.
