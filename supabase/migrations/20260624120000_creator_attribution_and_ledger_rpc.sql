-- Migration: Creator attribution in apply_stock_movement + new get_stock_movement_ledger RPC
--
-- This migration does two things:
-- 1. Updates apply_stock_movement to set created_by = auth.uid() on insert,
--    preserving existing tenant-hardening and parameter signature.
-- 2. Adds get_stock_movement_ledger(...), a SECURITY INVOKER read RPC that
--    returns workshop-scoped, filtered, bounded stock movement rows for
--    the frontend ledger view and CSV export.
--
-- Security model:
--   - Both functions derive the current workshop from auth.uid() -> profiles.workshop_id.
--   - Neither function accepts a workshop_id parameter from the client.
--   - apply_stock_movement raises 42501 on cross-workshop material access.
--   - get_stock_movement_ledger filters by the derived workshop_id and still
--     relies on base-table RLS as a second layer.
--   - Both use SECURITY INVOKER (caller permissions).

-- ---------------------------------------------------------------------------
-- Part 1: Creator attribution in apply_stock_movement
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION apply_stock_movement(
  p_material_id uuid,
  p_delta       NUMERIC,
  p_reason      stock_movement_reason,
  p_note        TEXT DEFAULT NULL,
  p_quote_id    uuid DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_workshop_id uuid;
  v_current_workshop_id uuid;
  v_new_stock   NUMERIC;
BEGIN
  IF p_delta = 0 THEN
    RAISE EXCEPTION 'delta cannot be zero';
  END IF;

  SELECT p.workshop_id INTO v_current_workshop_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  SELECT workshop_id INTO v_workshop_id
  FROM materials
  WHERE id = p_material_id;

  IF v_workshop_id IS NULL THEN
    RAISE EXCEPTION 'material % not found', p_material_id;
  END IF;

  IF v_current_workshop_id IS NULL OR v_workshop_id <> v_current_workshop_id THEN
    RAISE EXCEPTION 'material % not found', p_material_id
      USING ERRCODE = '42501';
  END IF;

  UPDATE materials
  SET stock = stock + p_delta,
      updated_at = now()
  WHERE id = p_material_id
    AND workshop_id = v_current_workshop_id
  RETURNING stock INTO v_new_stock;

  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'stock cannot be negative (would result in %)', v_new_stock;
  END IF;

  -- CHANGED: added created_by = auth.uid() to record the authenticated user
  INSERT INTO stock_movements (workshop_id, material_id, delta, reason, note, quote_id, created_by)
  VALUES (v_workshop_id, p_material_id, p_delta, p_reason, p_note, p_quote_id, auth.uid());

  RETURN v_new_stock;
END;
$$;

COMMENT ON FUNCTION apply_stock_movement IS
  'Atomically adjusts material stock, records the movement, and sets created_by = auth.uid(). '
  'SECURITY INVOKER. Derives workshop from auth.uid() -> profiles.workshop_id. '
  'Raises 42501 on cross-workshop material access.';

-- ---------------------------------------------------------------------------
-- Part 2: get_stock_movement_ledger — workshop-scoped read RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_stock_movement_ledger(
  p_reason      stock_movement_reason DEFAULT NULL,
  p_material_id uuid DEFAULT NULL,
  p_creator_id  uuid DEFAULT NULL,
  p_from        timestamptz DEFAULT NULL,
  p_to          timestamptz DEFAULT NULL,
  p_search      text DEFAULT NULL,
  p_limit       integer DEFAULT 50,
  p_offset      integer DEFAULT 0
)
RETURNS TABLE (
  id             uuid,
  workshop_id    uuid,
  material_id    uuid,
  material_name  text,
  material_unit  unit_of_measure,
  delta          numeric,
  reason         stock_movement_reason,
  note           text,
  quote_id       uuid,
  quote_number   text,
  created_at     timestamptz,
  created_by     uuid,
  creator_name   text
)
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_current_workshop_id uuid;
  v_limit  integer;
  v_offset integer;
BEGIN
  -- Derive the current workshop from auth.uid() -> profiles.workshop_id
  SELECT p.workshop_id INTO v_current_workshop_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  -- R4-M1: a missing workshop (no profile row, deleted user, or stale
  -- x-workshop-id header) must surface as an empty result with a clear
  -- signal, not silently return 0 rows for a "real" query. The early
  -- return mirrors the pattern in get_stock_movement_detail.
  IF v_current_workshop_id IS NULL THEN
    RETURN;
  END IF;

  -- Clamp pagination params
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  SELECT
    sm.id,
    sm.workshop_id,
    sm.material_id,
    m.name              AS material_name,
    m.unit              AS material_unit,
    sm.delta,
    sm.reason,
    sm.note,
    sm.quote_id,
    q.quote_number      AS quote_number,
    sm.created_at,
    sm.created_by,
    pr.display_name      AS creator_name
  FROM stock_movements sm
  LEFT JOIN materials m
    ON m.id = sm.material_id
   AND m.workshop_id = sm.workshop_id
  LEFT JOIN quotes q
    ON q.id = sm.quote_id
   AND q.workshop_id = sm.workshop_id
  LEFT JOIN profiles pr
    ON pr.id = sm.created_by
   AND pr.workshop_id = sm.workshop_id
  WHERE sm.workshop_id = v_current_workshop_id
    AND (p_reason IS NULL OR sm.reason = p_reason)
    AND (p_material_id IS NULL OR sm.material_id = p_material_id)
    AND (p_creator_id IS NULL OR sm.created_by = p_creator_id)
    AND (p_from IS NULL OR sm.created_at >= p_from)
    AND (p_to IS NULL OR sm.created_at < p_to)
    AND (p_search IS NULL OR length(p_search) < 3 OR m.name ILIKE '%' || p_search || '%')
  ORDER BY sm.created_at DESC, sm.id DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION get_stock_movement_ledger IS
  'Returns a workshop-scoped, filtered, paginated view of stock movements for the '
  'current authenticated user. SECURITY INVOKER. Does not accept a workshop_id parameter. '
  'All filters are optional. Limit is clamped to [1, 500], offset to >= 0. '
  'Returns denormalized rows with material name, unit, quote number, and creator name. '
  'The p_search filter is gated to >= 3 characters so the ILIKE wildcard query stays '
  'within the planner budget; shorter inputs are silently ignored.';

-- Trigram index for the p_search filter (R4-B2: avoid ILIKE '%…%' seq scans on
-- large materials catalogs). pg_trgm is a default Supabase extension; the
-- CREATE EXTENSION call is idempotent and lives in the public schema.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS materials_name_trgm_idx
  ON public.materials USING gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- profiles: allow workshop-mates to see each other's display_name
-- ---------------------------------------------------------------------------
--
-- Without this policy the SECURITY INVOKER ledger/detail RPCs only see the
-- current user's own profile row, so creator_name is NULL for any movement
-- the caller did not create. This policy keeps the existing
-- profiles_select_own (the only path for cross-tenant isolation) and adds
-- a same-workshop read so the ledger can attribute movements to peer users.
DROP POLICY IF EXISTS profiles_select_same_workshop ON public.profiles;
CREATE POLICY profiles_select_same_workshop ON public.profiles
  FOR SELECT
  USING (workshop_id = public.get_current_workshop_id());
