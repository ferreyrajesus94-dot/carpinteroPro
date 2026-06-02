# Vercel config decision

Status: **Deferred**

CarpinteroPro does not add `vercel.json` or `.vercelignore` in SDD 5. Vercel already auto-deploys the frontend from `main`, and this slice records the criteria for future config instead of changing deploy behavior now.

## Context

This decision follows the SDD 5 Production Ops design: `openspec/changes/2026-06-02-sdd-5-production-ops/design.md`.

- Vercel handles frontend deployment from `main`.
- No project `vercel.json` exists today.
- Vite build output and SPA routing currently rely on Vercel defaults.
- The app uses Supabase Auth, MercadoPago flows, PWA assets, and generated Vite chunks that could be affected by rewrites or headers.

## Options evaluated

| Option | Decision | Benefit | Risk |
| --- | --- | --- | --- |
| Defer config | Accepted | Avoids untested deploy behavior changes. | Production has no explicit CSP/security headers from repo config. |
| Add `vercel.json` | Deferred | Could define SPA rewrite and conservative headers. | May break auth redirects, MercadoPago return paths, PWA assets, service worker, or Vite chunks. |

## Compatibility checklist before implementation

Do not add `vercel.json` until these checks are planned for a preview deployment:

- [ ] Supabase Auth callback and redirect URLs still work.
- [ ] MercadoPago checkout return/callback paths still work.
- [ ] PWA manifest loads.
- [ ] Service worker loads or is intentionally scoped.
- [ ] Generated JS/CSS Vite chunks load without 404s.
- [ ] Direct links to nested app routes resolve to the SPA.
- [ ] Any security headers are compatible with Supabase, MercadoPago, images/icons, and PWA assets.

## Trigger criteria for implementation

Implement `vercel.json` only if at least one trigger is true:

- Deep links break in Vercel preview or production.
- Security review or compliance requires explicit headers before launch.
- The team accepts the verification burden for deploy config changes.

## Future implementation rules

If implementation is approved later:

1. Update this status from `Deferred` to `Implemented` with the approval reference.
2. Add the config in its own reviewable work unit.
3. Run:
   ```bash
   npm test
   npm run lint
   npm run build
   ```
4. Complete preview smoke checks for `/`, a nested app route, PWA assets, Supabase Auth, MercadoPago, and generated chunks.

## Risk accepted by deferring

The project accepts that SDD 5 does not define explicit Vercel security headers or ignore rules. This keeps production behavior stable until a concrete routing, security, or compliance need justifies the change.
