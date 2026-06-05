# Environment setup for CarpinteroPro

Use this guide to configure local, preview, and production environments without exposing server-only secrets to the browser.

## Quick path

1. Copy `.env.example` to `.env.local` for local frontend development.
2. Fill only the public `VITE_*` Supabase values in frontend environments.
3. Store service role and MercadoPago values as Supabase Edge Function secrets.
4. Verify Supabase Auth redirect URLs for every deployed origin.

## Environment contexts

| Context | Where values live | Use |
| --- | --- | --- |
| Local frontend | `.env.local` | Vite development server. |
| Vercel preview/staging | Vercel project environment variables | Browser-safe frontend build values only. |
| Vercel production | Vercel project environment variables | Production frontend build values only. |
| Supabase Edge Functions | Supabase dashboard or CLI secrets | Server-only Supabase and MercadoPago integration values. |

## Public frontend variables

These values are exposed to the browser by Vite. They are safe to configure in `.env.local` and Vercel frontend environments.

| Variable | Source | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase dashboard → Project settings → API | Frontend Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Project settings → API | Public anon key used with RLS. |
| `VITE_SENTRY_DSN` | Sentry project settings, if observability is enabled | Optional browser error reporting DSN; leave blank to keep reporting no-op. |
| `VITE_SUPPORT_EMAIL` | Product/support inbox | Optional support address used to build safe `mailto:` links in recovery screens. |

Example:

```dotenv
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_SENTRY_DSN=
VITE_SUPPORT_EMAIL=soporte@example.com
```

## Server-only secrets

Do not put these values in `.env.local` for frontend builds or in Vercel `VITE_*` variables. Configure them as Supabase Edge Function secrets.

| Variable | Storage | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase Edge Function secret | Server-side Supabase client URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secret only | Privileged server operations; never expose in the browser. |
| `MERCADOPAGO_ACCESS_TOKEN` | Supabase Edge Function secret | MercadoPago API access. |
| `MERCADOPAGO_WEBHOOK_SECRET` | Supabase Edge Function secret | MercadoPago webhook signature validation. |
| `APP_ORIGIN` | Supabase Edge Function secret | Allowed frontend origin for CORS and redirects. |
| `MERCADOPAGO_SANDBOX_PAYER_EMAIL` | Supabase Edge Function secret | Sandbox buyer account for payment tests. |

Placeholder command shape:

```bash
npx supabase secrets set NAME=<set-in-supabase-secrets>
```

Set real values only in your shell or dashboard session; do not paste them into tracked docs.

## MercadoPago sandbox and production

| Mode | What to use | Notes |
| --- | --- | --- |
| Sandbox | Test access token, webhook secret, sandbox payer email | Use for local and preview billing validation. |
| Production | Production access token and webhook secret | Use only after redirect URLs and webhook endpoints are verified. |

Checklist:

- [ ] Confirm whether the target environment uses sandbox or production credentials.
- [ ] Store the access token as `MERCADOPAGO_ACCESS_TOKEN` in Supabase Edge Function secrets.
- [ ] Store webhook signing material as `MERCADOPAGO_WEBHOOK_SECRET`.
- [ ] Set `APP_ORIGIN` to the exact frontend origin for the environment.
- [ ] For sandbox tests, set `MERCADOPAGO_SANDBOX_PAYER_EMAIL` to the approved sandbox payer account.

## `VITE_WORKSHOP_ID` status

`VITE_WORKSHOP_ID` is obsolete. SDD 1 removed client-controlled tenant selection; workshop identity is now derived server-side through `auth.uid() → profiles.workshop_id` and protected by RLS. Do not add this variable to new frontend environments.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| App cannot connect to Supabase | Confirm `VITE_SUPABASE_URL` matches the project URL and includes the protocol. |
| Auth succeeds but data is empty | Confirm the user has a profile with the expected `workshop_id`; do not add client tenant overrides. |
| Browser reports CORS issues from functions | Confirm `APP_ORIGIN` matches the frontend origin and the function was redeployed after secret changes if needed. |
| Billing sandbox flow fails | Confirm MercadoPago sandbox token, webhook secret, and sandbox payer email belong to the same test setup. |
| Production build points at the wrong backend | Check Vercel environment variables for the selected deployment environment. |

## Next step

Before production release, complete [`supabase-production-checklist.md`](supabase-production-checklist.md).
