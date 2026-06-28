-- PR 2: Approved BOM lines table and capture RPC
-- Creates an immutable approved BOM source for production deduction
-- so production start never reads mutable recipe/template rows.

-- ═══════════════════════════════════════════════════════════════
-- 1. quote_approved_bom_lines table
-- ═══════════════════════════════════════════════════════════════

create table if not exists quote_approved_bom_lines (
  id                   uuid primary key default gen_random_uuid(),
  workshop_id          uuid not null references workshops(id),
  quote_id             uuid not null references quotes(id) on delete cascade,
  line_number          integer not null,
  source_recipe_snapshot_id uuid null references quote_recipe_snapshots(id) on delete set null,
  material_id          uuid null references materials(id) on delete set null,
  material_name        text not null,
  material_unit        text not null,
  material_category    text not null,
  deduction_quantity   numeric(12,2) null check (deduction_quantity is null or deduction_quantity > 0),
  calculation_method   text not null,
  is_complete          boolean not null default true,
  warning_code         text null,
  calculation_context  jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

-- Constraints and indexes
create unique index if not exists uq_approved_bom_line
  on quote_approved_bom_lines (quote_id, line_number);

create index if not exists idx_approved_bom_workshop_quote
  on quote_approved_bom_lines (workshop_id, quote_id);

-- RLS
alter table quote_approved_bom_lines enable row level security;

create policy "workshop_select_approved_bom_lines" on quote_approved_bom_lines
  for select using (workshop_id = get_current_workshop_id());

create policy "workshop_insert_approved_bom_lines" on quote_approved_bom_lines
  for insert with check (
    workshop_id = get_current_workshop_id()
    and (select workshop_role from profiles where id = auth.uid()) in ('admin', 'operational')
  );

create policy "workshop_update_approved_bom_lines" on quote_approved_bom_lines
  for update using (
    workshop_id = get_current_workshop_id()
    and (select workshop_role from profiles where id = auth.uid()) in ('admin', 'operational')
  );

create policy "workshop_delete_approved_bom_lines" on quote_approved_bom_lines
  for delete using (
    workshop_id = get_current_workshop_id()
    and (select workshop_role from profiles where id = auth.uid()) in ('admin', 'operational')
  );

-- ═══════════════════════════════════════════════════════════════
-- 2. Helper: get deduction quantity for a plate material via nesting
-- ═══════════════════════════════════════════════════════════════

create or replace function public._compute_plate_boards_needed(
  p_quote_id              uuid,
  p_material_id           uuid,
  p_template_length_cm    numeric,
  p_template_width_cm     numeric
)
returns numeric
language plpgsql stable
security definer
as $$
declare
  v_total_boards numeric := 0;
  v_piece record;
begin
  -- We cannot fully replicate computeNesting in PL/pgSQL for production.
  -- Approximate: sum(cut_piece.quantity) as total pieces, divide by max pieces per board
  -- A better approach: calculate total area / board area, rounded up
  -- Since we cannot run the JS nesting algorithm server-side, we store
  -- a best-estimate in the RPC. The accurate board count comes from
  -- the frontend's computeNesting call during capture.
  -- We use the simpler ceiling(area needed / board area) estimate here.
  
  -- Total area of all cut pieces for this material in this template
  select coalesce(sum(cp.quantity * cp.length_cm * cp.width_cm), 0)
    into v_total_boards
    from recipe_items ri
    join cut_pieces cp on cp.recipe_item_id = ri.id
    where ri.furniture_template_id = (
      select furniture_template_id from quotes where id = p_quote_id
    )
    and ri.material_id = p_material_id;
  
  if v_total_boards > 0 and p_template_length_cm > 0 and p_template_width_cm > 0 then
    v_total_boards := ceil(v_total_boards / (p_template_length_cm * p_template_width_cm));
  else
    v_total_boards := 0;
  end if;
  
  return v_total_boards;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Capture RPC
-- ═══════════════════════════════════════════════════════════════

create or replace function public.capture_quote_approved_bom(p_quote_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_workshop_id       uuid;
  v_current_status    text;
  v_snap              record;
  v_material          record;
  v_line_number       integer := 0;
  v_deduction_qty     numeric(12,2);
  v_calc_method       text;
  v_is_complete       boolean;
  v_warning_code      text;
  v_calc_ctx          jsonb;
  v_boards_needed     numeric;
  v_has_cut_pieces    boolean;
begin
  -- 1. Lock the quote and derive workshop
  select workshop_id, status into v_workshop_id, v_current_status
    from quotes where id = p_quote_id
    for update;
  
  if not found then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  
  if v_workshop_id <> get_current_workshop_id() then
    raise exception 'Cross-workshop access denied' using errcode = '42501';
  end if;

  -- 2b. Role check: only admin/operational can capture the approved BOM
  if (select workshop_role from profiles where id = auth.uid()) not in ('admin', 'operational') then
    raise exception 'not authorized to capture approved BOM' using errcode = '42501';
  end if;
  
  -- 2. Only capture for approved quotes. The caller is responsible for
  -- invoking this immediately after the transition to aprobado; this guard
  -- prevents accidental BOM capture from draft/sent/cancelled quotes.
  if v_current_status <> 'aprobado' then
    raise exception 'Quote must be approved before capturing approved BOM'
      using errcode = 'P0001';
  end if;

  -- Re-capture is allowed in PR 2 while no production batch table exists.
  -- PR 3 adds the production-batch guard before deduction can happen.

  -- 3. Clear previous approved BOM lines for this quote
  delete from quote_approved_bom_lines where quote_id = p_quote_id;
  
  -- 4. Iterate over quote recipe snapshots
  for v_snap in
    select * from quote_recipe_snapshots
    where quote_id = p_quote_id
    order by created_at, id
  loop
    v_line_number := v_line_number + 1;
    v_deduction_qty := null;
    v_calc_method := 'direct_quantity';
    v_is_complete := true;
    v_warning_code := null;
    v_calc_ctx := '{}'::jsonb;
    v_boards_needed := null;
    v_has_cut_pieces := false;

    -- Look up the material to determine if it's a plate
    select wood_subtype, unit, length_cm, width_cm
      into v_material
      from materials
      where id = v_snap.material_id;
    
    if v_snap.material_id is null then
      -- Material was deleted or unresolved
      v_deduction_qty := null;
      v_calc_method := 'unresolved';
      v_is_complete := false;
      v_warning_code := 'missing_material';
      v_calc_ctx := jsonb_build_object(
        'reason', 'material_id is null at capture time',
        'snapshot_id', v_snap.id,
        'material_name', v_snap.material_name
      );
    elsif v_material.wood_subtype = 'placa' and v_material.unit = 'un' then
      -- Plate material: check cut_pieces
      select exists(
        select 1 from recipe_items ri
        join cut_pieces cp on cp.recipe_item_id = ri.id
        where ri.furniture_template_id = (
          select furniture_template_id from quotes where id = p_quote_id
        )
        and ri.material_id = v_snap.material_id
      ) into v_has_cut_pieces;
      
      if v_has_cut_pieces
         and v_material.length_cm is not null
         and v_material.width_cm is not null
      then
        -- Compute boards needed (approximate)
        v_boards_needed := public._compute_plate_boards_needed(
          p_quote_id,
          v_snap.material_id,
          v_material.length_cm,
          v_material.width_cm
        );
        
        if v_boards_needed > 0 then
          v_deduction_qty := v_boards_needed;
          v_calc_method := 'plate_nesting';
          v_is_complete := true;
          v_calc_ctx := jsonb_build_object(
            'snapshot_quantity', v_snap.quantity,
            'board_length_cm', v_material.length_cm,
            'board_width_cm', v_material.width_cm,
            'boards_needed_computed', v_boards_needed
          );
        else
          -- Cannot compute boards from cut pieces
          v_deduction_qty := v_snap.quantity;
          v_calc_method := 'direct_quantity';
          v_is_complete := true;
          v_warning_code := 'nesting_zero_boards';
          v_calc_ctx := jsonb_build_object(
            'snapshot_quantity', v_snap.quantity,
            'note', 'cut pieces exist but computed zero boards; used snapshot quantity as fallback'
          );
        end if;
      elsif v_material.length_cm is not null and v_material.width_cm is not null then
        -- Has board dimensions but no cut pieces: use area-based estimate
        v_deduction_qty := ceil(v_snap.quantity / (v_material.length_cm * v_material.width_cm / 10000));
        -- ^ snapshot quantity is likely in m², convert to cm² for board count
        v_calc_method := 'plate_nesting';
        v_is_complete := false;
        v_warning_code := 'missing_cut_pieces';
        v_calc_ctx := jsonb_build_object(
          'snapshot_quantity', v_snap.quantity,
          'board_length_cm', v_material.length_cm,
          'board_width_cm', v_material.width_cm,
          'estimated_boards', v_deduction_qty
        );
      else
        -- Plate material with insufficient dimension data
        v_deduction_qty := v_snap.quantity;
        v_calc_method := 'direct_quantity';
        v_is_complete := false;
        v_warning_code := 'missing_plate_dimensions';
        v_calc_ctx := jsonb_build_object(
          'snapshot_quantity', v_snap.quantity,
          'material_length_cm', v_material.length_cm,
          'material_width_cm', v_material.width_cm
        );
      end if;
    else
      -- Non-plate material: use snapshot quantity directly
      v_deduction_qty := v_snap.quantity;
      v_calc_method := 'direct_quantity';
      v_is_complete := true;
      v_calc_ctx := jsonb_build_object(
        'snapshot_quantity', v_snap.quantity,
        'waste_pct', v_snap.waste_pct
      );
    end if;

    -- Insert the approved BOM line
    insert into quote_approved_bom_lines (
      workshop_id, quote_id, line_number,
      source_recipe_snapshot_id, material_id,
      material_name, material_unit, material_category,
      deduction_quantity, calculation_method,
      is_complete, warning_code, calculation_context
    ) values (
      v_workshop_id, p_quote_id, v_line_number,
      v_snap.id, v_snap.material_id,
      v_snap.material_name, v_snap.material_unit, v_snap.material_category,
      v_deduction_qty, v_calc_method,
      v_is_complete, v_warning_code, v_calc_ctx
    );
  end loop;

  -- If no snapshots found, insert a single warning line
  if v_line_number = 0 then
    insert into quote_approved_bom_lines (
      workshop_id, quote_id, line_number,
      material_name, material_unit, material_category,
      deduction_quantity, calculation_method,
      is_complete, warning_code, calculation_context
    ) values (
      v_workshop_id, p_quote_id, 1,
      '(sin materiales)', '', '',
      null, 'no_snapshots',
      false, 'no_recipe_snapshots',
      '{}'::jsonb
    );
  end if;
end;
$$;
