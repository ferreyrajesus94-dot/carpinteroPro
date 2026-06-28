-- PR7: Allow controlled negative stock in start_quote_production
--
-- Background:
-- The table-level constraint `materials_stock_check (stock >= 0)` blocks the
-- controlled production-start RPC from taking material stock below zero,
-- even though the design explicitly allows this for confirmed production
-- starts (see openspec/changes/archive/2026-06-27-production-stock-deduction-settings/specs/inventory/spec.md:
-- "Insufficient Stock Warning and Controlled Negative Stock" — the system
-- MUST allow the resulting stock to become negative for the controlled
-- production-deduction path).
--
-- Policy (enforced at the RPC layer, not at the table layer):
--   - apply_stock_movement RPC: STRICT — rejects negative stock
--   - reverse_production_stock_deduction RPC: STRICT — rejects negative stock
--   - stock_movement_creator / hardened_stock_movement_rpc: STRICT
--   - start_quote_production RPC: ALLOWS negative stock after the user
--     confirms the production-start review. The batch records
--     `shortage_detected = true` and a structured entry in
--     `warning_summary` so the operator sees the projected negative stock.
--     This is the only path allowed to take stock below zero.
--
-- Fix: drop the table-level `materials_stock_check` constraint. All other
-- stock-update paths already enforce the negative-stock policy at the
-- function layer (see `IF v_new_stock < 0` checks in
-- supabase/migrations/0007_stock_movements.sql,
-- 20260605000100_harden_stock_movement_rpc.sql,
-- 20260624120000_creator_attribution_and_ledger_rpc.sql,
-- 20260625183000_stock_movement_reversals.sql, and
-- 20260627000004_guard_production_deduction_rpc_path.sql). The table
-- constraint was overzealous and broke the controlled path without adding
-- any real safety on top of what the RPCs already enforce.
--
-- Rollback notes:
--   Re-add the constraint with:
--     ALTER TABLE public.materials ADD CONSTRAINT materials_stock_check
--       CHECK (stock >= 0);
--   But this will re-break the production-start shortage path. Only do this
--   if a different fix for shortage handling is being designed.

-- Comment the constraint first so the COMMENT runs while the constraint
-- still exists. The DROP below then removes the constraint itself.
COMMENT ON CONSTRAINT materials_stock_check ON public.materials IS
  'Constraint scheduled for removal in PR7. The negative-stock policy is now '
  'enforced at the RPC layer; see the column comment on public.materials.stock '
  '(set just below) for details.';

ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_stock_check;

COMMENT ON COLUMN public.materials.stock IS
  'Material stock in workshop units. Negative values are allowed only on the '
  'controlled production-start path (start_quote_production RPC) after user '
  'confirmation, with shortage_detected + warning_summary recorded on the '
  'batch. The generic apply_stock_movement and reversal RPCs remain strict '
  'and reject negative stock at the function layer. PR7 fix.';
