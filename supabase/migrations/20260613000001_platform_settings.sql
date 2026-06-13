-- Platform-wide settings table for admin-controlled flags (maintenance mode, etc.).
-- Only accessed via admin Edge Functions with service_role; RLS prevents direct client access.

CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read platform settings (maintenance banner, etc.).
-- Only platform admins can write via Edge Functions (service_role bypasses RLS).
CREATE POLICY "Authenticated users can read settings" ON platform_settings
  FOR SELECT USING (auth.role() = 'authenticated');

INSERT INTO platform_settings (key, value)
VALUES ('maintenance', '{"enabled": false, "message": "CarpinteroPro está en mantenimiento. Volvé en unos minutos."}')
ON CONFLICT (key) DO NOTHING;
