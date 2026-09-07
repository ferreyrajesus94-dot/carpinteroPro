# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: a solo carpenter or workshop owner, Spanish-speaking (Rioplatense register, voseo), running a one-person or small furniture workshop. They are not technical; they spend the day making furniture, not configuring software. They access the app from a phone or tablet on the workshop floor, often with dirty hands and poor lighting, and from a laptop at the desk. They want the tool to feel like a workshop instrument — direct, dependable, in Spanish, never in their way.

Secondary audience: contributors and forks of the open-source project (React 19 + Vite + TypeScript + Supabase developers).

The UI is scoped to the solo owner-operator. The infrastructure is multi-tenant (every domain table carries `workshop_id uuid NOT NULL` with RLS) to preserve a future multi-employee option, but the user-facing flows do not assume team views, per-user audit trails, or role-aware dashboards.

## Product Purpose

Give a solo carpenter a single place to run the workshop: track wood and hardware stock, define a furniture recipe once and quote it many times, send quotes to clients, start production from an approved quote (which automatically deducts the right material from stock and writes an immutable ledger entry), and keep a clean CRM with quote history.

Success means the carpenter stops juggling paper notebooks, WhatsApp threads, and a fragile spreadsheet, and always knows: what they have on the shelf, what a piece of furniture actually costs, what they charged the client, and what is in production. The tool disappears behind the work.

## Positioning

The defensible mechanism is the combination of four things a neighboring product could not truthfully copy all at once:

- **Snapshotted quotes.** A quote freezes the cost at quote time, so future material price changes never retroactively alter a sent quote.
- **Automatic stock deduction on production start.** An approved quote moving into production writes an immutable row per BOM line and updates `materials.stock` atomically through a single trusted RPC (`apply_stock_movement`); an `AFTER INSERT` trigger does the work.
- **Reversal-first ledger.** Every stock movement is a row; nothing is edited in place; reversals are first-class and idempotent.
- **Free and AGPL-3.0.** Open source, no paid tier gates the core workflow; modifications deployed as a network service must publish source.

The product positioning line, used as a binding commitment: "built for the workshop floor, not the spreadsheet."

## Operating Context

- The workshop floor is loud, dusty, and often outdoors or in a shed. Devices get dirty; touch targets must be large.
- Clients are reached on WhatsApp. Quote export to PDF and to WhatsApp share is a primary delivery path, not a nice-to-have.
- The carpenter's natural unit is a piece of furniture ("the bookshelf", "the dining table"), not a generic SKU. Recipes and quotes are organized around furniture, not raw line items.
- Material cost, client margin, and approval status are the three numbers the carpenter re-checks all day. The UI must surface them without a click.
- Spanish is the only language the product ships in. No English toggle exists today; no pseudo-i18n scaffolding is in place.
- Time horizon is the working week: what is in stock now, what is in production this week, what quote did the client approve yesterday.

## Capabilities and Constraints

Capabilities (all currently implemented under `src/features/`):

- Materials inventory with unit-of-measure, price-per-unit, minimum stock, price history charts.
- Stock movement ledger: purchase, consumption, shrinkage, adjustment, quote discount; reversal rows; immutable audit.
- Furniture recipes (BOM) with cut pieces and live cost calculation against current material prices.
- Quotes with recipe snapshots, margin rules, PDF and WhatsApp export, approval status on a Kanban board.
- Production orders: state machine on a Kanban board, automatic stock deduction on start via a Postgres trigger.
- CRM: clients with quote history and stats.
- Dashboard: workshop metrics and recent activity.
- Global cross-feature search.
- Workshop settings (e.g. auto stock discount toggle).
- Onboarding flow that creates the workshop and profile on first login.
- Platform admin tooling (Edge Functions): diagnostics, force-onboarding, toggle workshop, toggle maintenance, youtuber program.
- Multi-tenant isolation (every domain table has `workshop_id uuid NOT NULL`; RLS enabled on every table; workshop id is server-derived, never client-supplied).

Constraints (binding):

- **Spanish-only, Rioplatense register with voseo.** The OG tag copy "Presupuestá, organizá y vendé mejor tus trabajos de carpintería" is binding. Future copy uses voseo imperative and Rioplatense spelling (e.g. "vos" forms, not "tú"). No English toggle exists; none is planned.
- **WCAG 2.1 AA.** Contrast, keyboard, focus visibility, touch-target size, and ARIA basics are required on every shippable surface.
- **AGPL-3.0.** Source must remain open; no copyleft migration.
- **No paid tier.** The MercadoPago billing surface (`src/features/billing/`) is parked and is not offered.
- **Workshop id is server-derived.** The frontend never accepts a `workshop_id` parameter; it is resolved through `auth.uid() → profiles.workshop_id` server-side.
- **Service role key never reaches the frontend.** All client queries go through the typed Supabase client in `src/shared/lib/supabase`; admin secrets live in Edge Function secrets.
- **Strict TypeScript.** No `any`, no `var`, no unused imports.
- **Feature-sliced architecture.** A feature lives under `src/features/<name>/`; cross-feature imports are forbidden by ESLint; shared code lives only under `src/shared/`.
- **Solo owner-operator UI scope.** Permissions, dashboards, and audit views do not assume a team. Multi-employee UI is not promised.

Open / undecided facts:

- Mobile-native shells (iOS/Android wrappers) are not committed. The product is a PWA today.
- Visual identity (typography, palette, illustration style) is not committed at the product layer; whatever the incumbent CSS uses is incumbent evidence, not a pinned system.
- A formal content/security/privacy review schedule is not committed.

## Brand Commitments

- Name: **CarpinteroPro** (committed).
- Voice: **Spanish, Rioplatense register, voseo** (committed). Copy uses imperative-voseo verb forms ("presupuestá", "vendé", "organizá") consistent with the OG tag.
- Positioning line: **"built for the workshop floor, not the spreadsheet"** (committed).
- Tone: direct, practical, no marketing fluff; the carpenter is the audience, not a buyer.
- Identity constraints: free, open source, no vendor lock-in. No proprietary logos, partner marks, or third-party certifications in the brand surface.
- Inherited assets: `public/favicon.svg`, `public/icons.svg`, `public/icons/` (incumbent; not yet audited for a design system).

## Evidence on Hand

- Live demo at `https://carpintero-pro.vercel.app` (maintainer-gated; access is granted per request via a `demo`-tagged GitHub issue).
- Spanish copy already in `index.html` OG tags: title `CarpinteroPro`, description `Presupuestá, organizá y vendé mejor tus trabajos de carpintería`.
- Public repo at `https://github.com/ferreyrajesus94-dot/carpinteroPro` (incumbent; canonical).
- Canonical hosting: Supabase project `revbbzqjglqnphjrasvv`.
- CHANGELOG.md per-version history (currently `v0.3.1-beta.2`).
- `openspec/specs/` holds per-domain product specs; `openspec/changes/archive/` is the historical record of every change.
- The README's own "Key features" list, verified against `src/features/`, is the authoritative current capability list until a SPEC drift is logged.

Future work must not invent testimonials, customers, benchmarks, pricing tiers, or licensing claims beyond AGPL-3.0.

## Product Principles

1. **Workshop floor first.** Every UI choice is judged on whether it survives a dusty touchscreen in Spanish with one thumb. If it doesn't, it's wrong.
2. **Log everything, never edit.** Stock movements are immutable rows; quotes are snapshotted; reversals are first-class. Anything that mutates past truth in place is a bug.
3. **One workshop, one tenant.** The workshop id is server-derived. The client never picks it, never sends it, never sees a tenant chooser.
4. **Solo owner-operator scope.** UI flows assume one human; team views and per-user audit trails are explicitly out of scope until committed otherwise.
5. **Free and open source.** No paid feature gates the core workflow. A future MercadoPago tier, if it ever ships, must not lock material, recipes, quotes, or production behind it.
6. **Spanish, Rioplatense, voseo.** No English. No language toggle. Copy is written once, in Spanish, with voseo.

## Accessibility & Inclusion

- Standard: **WCAG 2.1 AA** is the binding target for every shipped surface.
- Audience-specific needs: solo workshop owner on the workshop floor — touch targets must be large enough for a thumb with dirty hands; contrast must survive poor lighting; the keyboard path must work because the laptop is the desk device; ARIA basics so screen readers don't fail the partially-sighted carpenter.
- The visual identity must remain inclusive: no color-only signaling for state, approval, or stock warnings.