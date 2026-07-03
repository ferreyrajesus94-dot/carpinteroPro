/**
 * Canonical production-order route prefix — owned by the production
 * feature but exposed through `@/shared` so other features can build
 * deep-link hrefs without importing from `src/features/production/**`
 * (the production `featureZone` ESLint boundary would reject that).
 *
 * The production feature itself re-exports this constant from its
 * public API; this file is the single source of truth. A future
 * route rename is a one-line change here.
 */
export const PRODUCTION_ORDER_DEEP_LINK_PATH_PREFIX = "/production" as const;
