-- 0009_furniture_metadata.sql
-- Agrega metadata a las plantillas de muebles: categoría, tags, medidas finales,
-- foto y margen sugerido. Todo opcional — no rompe plantillas existentes.

alter table furniture_templates
  add column category text,
  add column tags text[] not null default '{}',
  add column height_cm numeric check (height_cm is null or height_cm > 0),
  add column width_cm numeric check (width_cm is null or width_cm > 0),
  add column depth_cm numeric check (depth_cm is null or depth_cm > 0),
  add column photo_url text,
  add column suggested_margin_pct numeric
    check (suggested_margin_pct is null or (suggested_margin_pct >= 0 and suggested_margin_pct < 100));

create index if not exists furniture_templates_category_idx
  on furniture_templates (workshop_id, category);

comment on column furniture_templates.category is
  'Categoría libre (mesas, sillas, placares, etc.) para agrupar y filtrar.';
comment on column furniture_templates.tags is
  'Tags libres para búsqueda; array de strings.';
comment on column furniture_templates.suggested_margin_pct is
  'Margen sugerido (%) para calcular precio de venta base. 0 ≤ x < 100.';
