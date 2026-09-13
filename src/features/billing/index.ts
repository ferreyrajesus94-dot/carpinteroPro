/**
 * Public API for the billing feature.
 *
 * The app is free. All payment / gating code has been removed from the
 * user-facing journey. Only the read-only `BillingSettingsCard` remains;
 * the user-facing UI never reads subscription state — the card is
 * always composed with `subscription={null}` and renders the
 * "Sin suscripción activa" copy.
 *
 * Anything that calls `create-subscription`, `useCreateSubscription`,
 * `BillingGate`, `useSubscription` (the render-blocking shape) is out
 * of scope for the free journey and intentionally not re-exported here.
 *
 * Note: `useCancelSubscription` is intentionally not re-exported because
 * the only consumer is the admin surface (`/admin/*`), which already
 * imports the billing/api actions directly. Keeping the export surface
 * narrow makes it easy to audit what the user journey can call.
 */
export { BillingSettingsCard } from "./components/BillingSettingsCard";
export type { SubscriptionRow, BillingAccess } from "./types";
