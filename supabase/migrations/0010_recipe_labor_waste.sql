-- 0010_recipe_labor_waste.sql
-- Fase 7: merma por item de material + mano de obra como item separado.

-- Merma (%) por item de material. Se aplica multiplicando la cantidad.
alter table recipe_items
  add column waste_pct numeric not null default 0
  check (waste_pct >= 0 and waste_pct < 100);

comment on column recipe_items.waste_pct is
  'Porcentaje de merma aplicado a la cantidad al calcular el costo (0–99).';

-- Mano de obra: tabla hermana de recipe_items, referenciada al mismo template.
create table if not exists labor_items (
  id uuid primary key default gen_random_uuid(),
  furniture_template_id uuid not null references furniture_templates(id) on delete cascade,
  description text not null,
  hours numeric not null check (hours > 0),
  rate numeric not null check (rate >= 0),
  created_at timestamptz not null default now()
);

create index if not exists labor_items_template_idx
  on labor_items (furniture_template_id);

alter table labor_items enable row level security;

create policy "labor_items by workshop"
  on labor_items for all
  using (
    exists (
      select 1 from furniture_templates ft
      where ft.id = labor_items.furniture_template_id
        and ft.workshop_id = current_setting('request.jwt.claim.workshop_id', true)::uuid
    )
  )
  with check (
    exists (
      select 1 from furniture_templates ft
      where ft.id = labor_items.furniture_template_id
    )
  );

-- Tarifa por defecto de mano de obra, para prellenar inputs.
alter table workshop_settings
  add column default_labor_rate numeric
  check (default_labor_rate is null or default_labor_rate >= 0);

comment on column workshop_settings.default_labor_rate is
  'Tarifa por hora sugerida al agregar ítems de mano de obra.';
