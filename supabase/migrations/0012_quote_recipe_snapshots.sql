-- Fase 12: snapshot de receta en presupuestos.
-- Congelamos los items de la plantilla al momento de crear/editar el quote
-- para que cambios posteriores en la plantilla no alteren presupuestos viejos.
create table if not exists quote_recipe_snapshots (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  material_id uuid references materials(id) on delete set null,
  material_name text not null,
  material_unit text not null,
  material_category text not null,
  quantity numeric not null,
  waste_pct numeric not null default 0,
  price_per_unit numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists quote_labor_snapshots (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  description text not null,
  hours numeric not null,
  rate numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists quote_recipe_snapshots_quote_id_idx on quote_recipe_snapshots(quote_id);
create index if not exists quote_labor_snapshots_quote_id_idx on quote_labor_snapshots(quote_id);

alter table quote_recipe_snapshots enable row level security;
alter table quote_labor_snapshots enable row level security;

drop policy if exists "workshop_isolation_quote_recipe_snapshots" on quote_recipe_snapshots;
create policy "workshop_isolation_quote_recipe_snapshots" on quote_recipe_snapshots
  for all
  using (
    exists (
      select 1 from quotes q
      where q.id = quote_recipe_snapshots.quote_id
        and q.workshop_id = get_current_workshop_id()
    )
  )
  with check (
    exists (
      select 1 from quotes q
      where q.id = quote_recipe_snapshots.quote_id
        and q.workshop_id = get_current_workshop_id()
    )
  );

drop policy if exists "workshop_isolation_quote_labor_snapshots" on quote_labor_snapshots;
create policy "workshop_isolation_quote_labor_snapshots" on quote_labor_snapshots
  for all
  using (
    exists (
      select 1 from quotes q
      where q.id = quote_labor_snapshots.quote_id
        and q.workshop_id = get_current_workshop_id()
    )
  )
  with check (
    exists (
      select 1 from quotes q
      where q.id = quote_labor_snapshots.quote_id
        and q.workshop_id = get_current_workshop_id()
    )
  );
