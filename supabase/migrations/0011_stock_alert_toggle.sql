-- Fase 8: toggle de alerta de stock insuficiente al abrir mueble
alter table workshop_settings
  add column if not exists stock_alert_enabled boolean not null default false;
