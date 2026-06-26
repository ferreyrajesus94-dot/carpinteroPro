-- Migration: Append-only stock movement reversals
--
-- Adds the minimal workshop role model needed to authorize stock movement
-- reversals server-side, then adds append-only reversal metadata and RPCs.
-- Original stock movement rows remain immutable for authenticated users.
--
-- Rollback notes (see also: R4-M5 of the pre-PR review):
-- * ALTER TYPE ... ADD VALUE is not safely rollback-able in older Postgres
--   versions and persists across partial-transaction failures. The new
--   'reversion' value can be removed with ALTER TYPE ... RENAME VALUE
--   'reversion' TO 'reversion_unused' on rollback, or by recreating the
--   enum. Document in any down migration that ships.
-- * All other schema changes use IF NOT EXISTS / CREATE OR REPLACE so the
--   migration is idempotent and individually re-runnable.

-- ---------------------------------------------------------------------------
-- Part 1: Minimal workshop role model
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workshop_user_role') THEN
    CREATE TYPE public.workshop_user_role AS ENUM ('admin', 'operational', 'viewer');
  END IF;
END;
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS workshop_role public.workshop_user_role NOT NULL DEFAULT 'admin';

COMMENT ON COLUMN public.profiles.workshop_role IS
  'Workshop-level role used for operational authorization. Stock movement reversals are allowed for admin and operational users only.';

CREATE OR REPLACE FUNCTION public.prevent_profile_workshop_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF OLD.workshop_role IS DISTINCT FROM NEW.workshop_role
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'profiles.workshop_role cannot be changed by authenticated users'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_workshop_role_change ON public.profiles;
CREATE TRIGGER prevent_profile_workshop_role_change
  BEFORE UPDATE OF workshop_role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_workshop_role_change();

-- ---------------------------------------------------------------------------
-- Part 2: Reversal schema
-- ---------------------------------------------------------------------------

ALTER TYPE public.stock_movement_reason ADD VALUE IF NOT EXISTS 'reversion';

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS reversal_of_movement_id uuid NULL REFERENCES public.stock_movements(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reversal_reason text NULL,
  ADD COLUMN IF NOT EXISTS reversed_original_reason public.stock_movement_reason NULL,
  ADD COLUMN IF NOT EXISTS reversal_request_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_reversal_not_self'
  ) THEN
    ALTER TABLE public.stock_movements
      ADD CONSTRAINT stock_movements_reversal_not_self
      CHECK (reversal_of_movement_id IS NULL OR reversal_of_movement_id <> id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_reversal_reason_required'
  ) THEN
    ALTER TABLE public.stock_movements
      ADD CONSTRAINT stock_movements_reversal_reason_required
      CHECK (reversal_of_movement_id IS NULL OR length(trim(coalesce(reversal_reason, ''))) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_reversal_original_reason_required'
  ) THEN
    ALTER TABLE public.stock_movements
      ADD CONSTRAINT stock_movements_reversal_original_reason_required
      CHECK (reversal_of_movement_id IS NULL OR reversed_original_reason IS NOT NULL);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_one_reversal_per_original_idx
  ON public.stock_movements (reversal_of_movement_id)
  WHERE reversal_of_movement_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_reversal_request_idx
  ON public.stock_movements (workshop_id, reversal_request_id)
  WHERE reversal_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS stock_movements_reversal_lookup_idx
  ON public.stock_movements (workshop_id, reversal_of_movement_id, created_at DESC)
  WHERE reversal_of_movement_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Part 3: Preserve movement immutability for authenticated callers
--
-- The trigger below is the second enforcement point for the append-only
-- contract on stock_movements. The primary enforcement is the original
-- stock_movements_update / stock_movements_delete RLS policies from
-- 0007_stock_movements.sql, which scope UPDATE/DELETE to the caller's
-- workshop. The trigger adds defense in depth: if a future migration
-- re-introduces a permissive policy by mistake, the trigger still blocks
-- any authenticated UPDATE/DELETE.
--
-- Why we keep the original RLS policies (instead of dropping them as the
-- pre-PR review initially suggested): the reverse_stock_movement RPC
-- uses SELECT ... FOR UPDATE on the original movement to serialize
-- concurrent reversal attempts, and FOR UPDATE requires UPDATE permission
-- under RLS. Deny-by-default RLS would silently fail the FOR UPDATE and
-- the RPC would never see the row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_authenticated_stock_movement_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'stock_movements are immutable; use reverse_stock_movement instead'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_authenticated_stock_movement_update ON public.stock_movements;
CREATE TRIGGER prevent_authenticated_stock_movement_update
  BEFORE UPDATE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_authenticated_stock_movement_mutation();

DROP TRIGGER IF EXISTS prevent_authenticated_stock_movement_delete ON public.stock_movements;
CREATE TRIGGER prevent_authenticated_stock_movement_delete
  BEFORE DELETE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_authenticated_stock_movement_mutation();

-- ---------------------------------------------------------------------------
-- Part 4: Reversal RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reverse_stock_movement(
  p_movement_id uuid,
  p_reversal_reason text,
  p_reversal_request_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_current_workshop_id uuid;
  v_current_role public.workshop_user_role;
  v_original public.stock_movements%ROWTYPE;
  v_current_stock numeric;
  v_new_stock numeric;
  v_reversal_delta numeric;
  v_reversal_movement_id uuid;
BEGIN
  IF p_movement_id IS NULL THEN
    RAISE EXCEPTION 'movement id is required';
  END IF;

  IF p_reversal_reason IS NULL OR length(trim(p_reversal_reason)) = 0 THEN
    RAISE EXCEPTION 'reversal reason is required';
  END IF;

  SELECT p.workshop_id, p.workshop_role
  INTO v_current_workshop_id, v_current_role
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  IF v_current_workshop_id IS NULL THEN
    RAISE EXCEPTION 'not authorized to reverse stock movements'
      USING ERRCODE = '42501';
  END IF;

  IF v_current_role NOT IN ('admin', 'operational') THEN
    RAISE EXCEPTION 'not authorized to reverse stock movements'
      USING ERRCODE = '42501';
  END IF;

  IF p_reversal_request_id IS NOT NULL THEN
    SELECT sm.id INTO v_reversal_movement_id
    FROM public.stock_movements AS sm
    WHERE sm.workshop_id = v_current_workshop_id
      AND sm.reversal_request_id = p_reversal_request_id;

    IF v_reversal_movement_id IS NOT NULL THEN
      RETURN v_reversal_movement_id;
    END IF;
  END IF;

  SELECT * INTO v_original
  FROM public.stock_movements AS sm
  WHERE sm.id = p_movement_id
    AND sm.workshop_id = v_current_workshop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stock movement not found'
      USING ERRCODE = '42501';
  END IF;

  IF v_original.reversal_of_movement_id IS NOT NULL THEN
    RAISE EXCEPTION 'reversal movements cannot be reversed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stock_movements AS existing_reversal
    WHERE existing_reversal.reversal_of_movement_id = v_original.id
  ) THEN
    RAISE EXCEPTION 'stock movement has already been reversed'
      USING ERRCODE = '23505';
  END IF;

  v_reversal_delta := v_original.delta * -1;

  SELECT m.stock INTO v_current_stock
  FROM public.materials AS m
  WHERE m.id = v_original.material_id
    AND m.workshop_id = v_current_workshop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'material not found for stock movement'
      USING ERRCODE = '42501';
  END IF;

  v_new_stock := v_current_stock + v_reversal_delta;

  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'stock cannot be negative (would result in %)', v_new_stock
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.materials
  SET stock = v_new_stock,
      updated_at = now()
  WHERE id = v_original.material_id
    AND workshop_id = v_current_workshop_id;

  INSERT INTO public.stock_movements (
    workshop_id,
    material_id,
    delta,
    reason,
    note,
    quote_id,
    created_by,
    reversal_of_movement_id,
    reversal_reason,
    reversed_original_reason,
    reversal_request_id
  )
  VALUES (
    v_original.workshop_id,
    v_original.material_id,
    v_reversal_delta,
    'reversion'::public.stock_movement_reason,
    'Reversión de movimiento ' || v_original.id::text,
    v_original.quote_id,
    auth.uid(),
    v_original.id,
    trim(p_reversal_reason),
    v_original.reason,
    p_reversal_request_id
  )
  RETURNING id INTO v_reversal_movement_id;

  RETURN v_reversal_movement_id;
END;
$$;

COMMENT ON FUNCTION public.reverse_stock_movement(uuid, text, uuid) IS
  'Creates an append-only compensating stock movement linked to the original. SECURITY INVOKER; derives workshop and role from auth.uid() -> profiles.';

-- ---------------------------------------------------------------------------
-- Part 5: Movement detail RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_stock_movement_detail(p_movement_id uuid)
RETURNS TABLE (
  id uuid,
  workshop_id uuid,
  material_id uuid,
  material_name text,
  material_unit unit_of_measure,
  delta numeric,
  reason public.stock_movement_reason,
  note text,
  quote_id uuid,
  quote_number text,
  created_at timestamptz,
  created_by uuid,
  creator_name text,
  reversal_of_movement_id uuid,
  reversal_reason text,
  reversed_original_reason public.stock_movement_reason,
  reversal_request_id uuid,
  is_reversal boolean,
  reversed_by_movement_id uuid,
  can_reverse boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_current_workshop_id uuid;
  v_current_role public.workshop_user_role;
BEGIN
  SELECT p.workshop_id, p.workshop_role
  INTO v_current_workshop_id, v_current_role
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  IF v_current_workshop_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    sm.id,
    sm.workshop_id,
    sm.material_id,
    m.name AS material_name,
    m.unit AS material_unit,
    sm.delta,
    sm.reason,
    sm.note,
    sm.quote_id,
    q.quote_number,
    sm.created_at,
    sm.created_by,
    pr.display_name AS creator_name,
    sm.reversal_of_movement_id,
    sm.reversal_reason,
    sm.reversed_original_reason,
    sm.reversal_request_id,
    sm.reversal_of_movement_id IS NOT NULL AS is_reversal,
    rev.id AS reversed_by_movement_id,
    sm.reversal_of_movement_id IS NULL
      AND rev.id IS NULL
      AND v_current_role IN ('admin', 'operational') AS can_reverse
  FROM public.stock_movements AS sm
  LEFT JOIN public.materials AS m
    ON m.id = sm.material_id
   AND m.workshop_id = sm.workshop_id
  LEFT JOIN public.quotes AS q
    ON q.id = sm.quote_id
   AND q.workshop_id = sm.workshop_id
  LEFT JOIN public.profiles AS pr
    ON pr.id = sm.created_by
   AND pr.workshop_id = sm.workshop_id
  LEFT JOIN public.stock_movements AS rev
    ON rev.reversal_of_movement_id = sm.id
   AND rev.workshop_id = sm.workshop_id
  WHERE sm.id = p_movement_id
    AND sm.workshop_id = v_current_workshop_id;
END;
$$;

COMMENT ON FUNCTION public.get_stock_movement_detail(uuid) IS
  'Returns one workshop-scoped stock movement with reversal linkage and authorization-derived can_reverse flag.';
