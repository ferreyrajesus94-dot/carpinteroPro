# SDD-10 Admin Actions — Spec

## Database changes

### Migration: workshop active flag

```sql
ALTER TABLE workshops ADD COLUMN is_active boolean NOT NULL DEFAULT true;
```

### Migration: platform settings table

```sql
CREATE TABLE platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
-- Only platform admins can read/write via Edge Functions
```

Seed row:
```sql
INSERT INTO platform_settings (key, value) VALUES ('maintenance', '{"enabled": false, "message": "CarpinteroPro está en mantenimiento. Volvé en unos minutos."}');
```

## Edge Function changes

### cancel-subscription (existing — expose to admin)

Already deployed. Admin invokes via `supabase.functions.invoke("cancel-subscription")`. Requires admin auth check added to the function.

### admin-toggle-subscription (new)

```
POST: { workshopId: string, action: "pause" | "resume" }
Response: { status: string, updatedAt: string }
Auth: requirePlatformAdmin
```

Updates `subscriptions.status` via service_role client.

### admin-retry-webhook (new)

```
POST: { eventId: string }
Response: { status: "sent" | "error", detail?: string }
Auth: requirePlatformAdmin
```

Sends a test notification to MercadoPago for the given webhook event.

### admin-force-onboarding (new)

```
POST: { profileId: string }
Response: { onboardedAt: string }
Auth: requirePlatformAdmin
```

Sets `profiles.onboarded_at = now()` for the given profile. Only if currently null.

### admin-toggle-maintenance (new)

```
POST: { enabled: boolean, message?: string }
Response: { enabled: boolean, message: string }
Auth: requirePlatformAdmin
```

Updates `platform_settings` value for key `maintenance`.

## Frontend changes

### BillingPage
- Add "Cancelar" button per row (if status !== cancelled)
- Confirmation dialog via shared ConfirmDialog
- Toast on success/error
- Add "Pausar"/"Reanudar" toggle button

### SupportPage
- Add "Reintentar" button for events with event_type containing "fail"
- Toast on success/error

### WorkshopDetailPage
- Add "Desactivar taller" / "Activar taller" toggle
- Show active/inactive badge
- Add "Forzar onboarding" button for profiles missing onboarded_at
- Show profiles list with onboarded status

### AdminLayout
- Add "Actualizar datos" button in header that calls `queryClient.invalidateQueries()`

### AppLayout (normal user shell)
- Add maintenance mode banner (reads from platform settings via a new hook)
- Dismissible per session

### New files
- `src/features/admin/api/actions.ts` — all new admin action API calls
- `src/features/admin/hooks/useAdminActions.ts` — mutation hooks
- `src/shared/hooks/useMaintenanceMode.ts` — read maintenance flag
- `supabase/functions/admin-toggle-subscription/index.ts`
- `supabase/functions/admin-retry-webhook/index.ts`
- `supabase/functions/admin-force-onboarding/index.ts`
- `supabase/functions/admin-toggle-maintenance/index.ts`
- Supabase migrations (2 files)

## Test cases

### Unit tests
- useAdminActions: cancel, toggle, retry, force-onboarding, maintenance
- BillingPage: cancel button renders, confirmation dialog, toast
- SupportPage: retry button on failed events only
- WorkshopDetailPage: deactivate toggle, force onboarding button
- AdminLayout: refresh button invalidates queries
- useMaintenanceMode: reads from API, shows banner when enabled
- AppLayout: banner visibility for non-admin users

### Edge Function tests (manual curl checklist)
- cancel-subscription: 401/403/admin success
- admin-toggle-subscription: pause → paused, resume → active
- admin-retry-webhook: valid event id → sent
- admin-force-onboarding: null onboarded_at → set to now()
- admin-toggle-maintenance: enable/disable with message

## API contracts

### POST /functions/v1/admin-toggle-subscription
```json
// Request
{ "workshopId": "uuid", "action": "pause" }
// Response 200
{ "status": "paused", "updatedAt": "2026-06-13T00:00:00Z" }
// Response 403
{ "error": { "code": "admin_auth_failed", "message": "Platform admin access required" } }
```

### POST /functions/v1/admin-retry-webhook
```json
// Request
{ "eventId": "uuid" }
// Response 200
{ "status": "sent" }
// Response 500
{ "error": { "code": "retry_failed", "message": "MercadoPago API error" } }
```

### POST /functions/v1/admin-force-onboarding
```json
// Request
{ "profileId": "uuid" }
// Response 200
{ "onboardedAt": "2026-06-13T00:00:00Z" }
// Response 400
{ "error": { "code": "already_onboarded", "message": "Profile already onboarded" } }
```

### POST /functions/v1/admin-toggle-maintenance
```json
// Request
{ "enabled": true, "message": "Mantenimiento programado" }
// Response 200
{ "enabled": true, "message": "Mantenimiento programado" }
```
