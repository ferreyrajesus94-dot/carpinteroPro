-- Fase 11: variantes paramétricas de muebles
-- params: [{name, default}, ...] guardados en la plantilla.
-- quantity_formula: expresión aritmética que usa variables de `params`;
-- si está presente, se usa en lugar de `quantity` al calcular.
alter table furniture_templates
  add column if not exists params jsonb not null default '[]'::jsonb;

alter table recipe_items
  add column if not exists quantity_formula text;
