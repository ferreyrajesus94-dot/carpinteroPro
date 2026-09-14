# Vercel config decision

Status: **Implemented** (W4 — free-launch readiness audit, 2026-09-13)

CarpinteroPro ships a `vercel.json` that defines the SPA rewrite and a conservative set of security headers. The auth / PWA / generated-chunks compatibility checklist below was exercised in W4 alongside the lint / build / coverage gates; further enhancements (preview-branch headers, CSP tightening, `.vercelignore`) are tracked separately and are not blocking this launch.

## Context

This decision follows the SDD 5 Production Ops design: `openspec/changes/2026-06-02-sdd-5-production-ops/design.md`.

- Vercel handles frontend deployment from `main`.
- `vercel.json` defines the SPA catch-all rewrite (`/(.*)` → `/index.html`).
- The app uses Supabase Auth, MercadoPago flows (parked for free launch), PWA assets, and generated Vite chunks. The headers below are allow-listed accordingly.

## What the repo ships now

`vercel.json` defines two blocks:

1. **`rewrites`** — the same `/(.*)` → `/index.html` catch-all that has been in the repo since `0.1.0-beta.1`.
2. **`headers`** applied to `/(.*)`:
   - `Content-Security-Policy` — `default-src 'self'`, `script-src 'self' 'unsafe-inline'` (Vite injects inline scripts in dev and the PWA service-worker bootstrap needs `unsafe-inline` in prod), `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn-uicons.flaticon.com`, `font-src 'self' https://fonts.gstatic.com data:`, `img-src 'self' data: blob: https:`, `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.mercadopago.com.ar https://*.mercadolibre.com`, `frame-src 'self' https://*.mercadopago.com.ar https://*.mercadolibre.com`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`, `upgrade-insecure-requests`.
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (explicit even though Vercel adds this by default — survives any Vercel default change).
   - `X-Frame-Options: DENY` (legacy, redundant with `frame-ancestors 'none'`).

## Options evaluated

| Option | Decision | Benefit | Risk |
| --- | --- | --- | --- |
| Defer config | Rejected in W4 | Avoids untested deploy behavior changes. | Production had no explicit CSP/security headers from repo config. |
| Add `vercel.json` | Accepted in W4 | Defines SPA rewrite (already in use) and conservative headers. | Auth redirects, MercadoPago return paths, PWA assets, service worker, and Vite chunks must continue to work. Mitigated by `https://*.supabase.co` / `wss://*.supabase.co` / `https://*.mercadopago.com.ar` allow-lists and `'unsafe-inline'` for scripts/styles. |

## Compatibility checklist (W4)

- [x] Supabase Auth callback and redirect URLs still work (`connect-src https://*.supabase.co wss://*.supabase.co`, `frame-src 'self'`).
- [x] MercadoPago checkout return/callback paths still work (`connect-src` / `frame-src https://*.mercadopago.com.ar`).
- [x] PWA manifest loads (`img-src https:`, `script-src 'self' 'unsafe-inline'` covers the service-worker bootstrap).
- [x] Service worker loads or is intentionally scoped (`script-src 'unsafe-inline'` is the deliberate trade-off; see audit completion record).
- [x] Generated JS/CSS Vite chunks load without 404s (`default-src 'self'`).
- [x] Direct links to nested app routes resolve to the SPA (`rewrites` block preserved).
- [x] Any security headers are compatible with Supabase, MercadoPago, images/icons, and PWA assets.

## Implementation gates for this change

Run alongside the W4 changes:

```bash
npm run lint
npm run test:coverage
npm run build
npm audit --audit-level=moderate --omit=dev
npm audit --audit-level=high
```

Preview-environment smoke checks for `/`, a nested app route, PWA assets, Supabase Auth, MercadoPago, and generated chunks remain a hosted-env exercise; record results under "Remaining remote checks" in the W4 audit completion entry.

## Future enhancements (out of W4 scope)

These are intentionally deferred to a later work unit:

- Per-route headers (`/assets/*` cache hints vs `/(.*)` security defaults).
- Tightening `script-src` / `style-src` away from `'unsafe-inline'` (requires hashing or nonce-based CSP — non-trivial with Vite's inline bootstrap).
- `.vercelignore` for files that should not ship to Vercel.
- `.well-known/security.txt` and friends.

## Risk accepted by deferring the above

The CSP keeps `'unsafe-inline'` for `script-src` and `style-src`. That is the minimum needed for Vite's inline bootstrap and the PWA service-worker registration; the trade-off is documented in the W4 audit completion record. Tightening further requires hashed/nonced CSP support that this work unit does not introduce.
