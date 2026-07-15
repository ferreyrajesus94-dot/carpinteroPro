-- Test: retryable billing webhook schema (Slice 1)
--
-- Verifies the additive schema contract required before the retryable RPC is introduced.

begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

-- Event ledger additions and safe legacy defaults.
select has_column('public', 'billing_webhook_events', 'contract_version', 'T1: event contract version exists');
select col_not_null('public', 'billing_webhook_events', 'contract_version', 'T2: event contract version is not null');
select col_default_is('public', 'billing_webhook_events', 'contract_version', 1::smallint, 'T3: legacy events default to contract version 1');
select has_column('public', 'billing_webhook_events', 'outcome', 'T4: event outcome exists');
select col_not_null('public', 'billing_webhook_events', 'outcome', 'T5: event outcome is not null');
select col_default_is('public', 'billing_webhook_events', 'outcome', 'legacy_uncertain'::text, 'T6: legacy events default to legacy_uncertain');
select ok(
  (select pg_get_constraintdef(oid) like '%legacy_uncertain%retryable%completed%terminal%stale%uncertain%'
   from pg_constraint
   where conrelid = 'public.billing_webhook_events'::regclass
     and conname = 'billing_webhook_events_outcome_check'),
  'T7: event outcome vocabulary is constrained'
);
select has_column('public', 'billing_webhook_events', 'attempt_count', 'T8: attempt count exists');
select col_not_null('public', 'billing_webhook_events', 'attempt_count', 'T9: attempt count is not null');
select col_default_is('public', 'billing_webhook_events', 'attempt_count', '0', 'T10: attempt count defaults to zero');
select has_column('public', 'billing_webhook_events', 'normalized_payload', 'T11: normalized payload exists');
select col_not_null('public', 'billing_webhook_events', 'normalized_payload', 'T12: normalized payload is not null');
select col_default_is('public', 'billing_webhook_events', 'normalized_payload', '{}'::jsonb, 'T13: normalized payload defaults to an empty object');
select has_column('public', 'billing_webhook_events', 'reconciliation_count', 'T14: reconciliation count exists');
select col_not_null('public', 'billing_webhook_events', 'reconciliation_count', 'T15: reconciliation count is not null');
select has_index('public', 'billing_webhook_events', 'billing_webhook_events_retryable_operational_idx', 'T16: operational retry index exists');

-- Subscription freshness additions.
select has_column('public', 'subscriptions', 'provider_snapshot_at', 'T17: subscription snapshot timestamp exists');
select has_column('public', 'subscriptions', 'provider_snapshot_resource_kind', 'T18: subscription snapshot resource kind exists');
select has_column('public', 'subscriptions', 'provider_snapshot_resource_id', 'T19: subscription snapshot resource id exists');
select has_column('public', 'subscriptions', 'provider_fetched_at', 'T20: subscription fetched timestamp exists');

-- Existing tenant ownership and restrictive posture remain unchanged.
select col_not_null('public', 'billing_webhook_events', 'workshop_id', 'T21: event workshop ownership remains not null');
select fk_ok('public', 'billing_webhook_events', 'workshop_id', 'public', 'workshops', 'id', 'T22: event workshop ownership foreign key remains intact');
select is((select confdeltype from pg_constraint where conrelid = 'public.billing_webhook_events'::regclass and conname = 'billing_webhook_events_workshop_id_fkey'), 'c', 'T23: event workshop foreign key remains ON DELETE CASCADE');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.billing_webhook_events'::regclass),
  'T24: event ledger RLS remains enabled'
);

select * from finish();

rollback;
