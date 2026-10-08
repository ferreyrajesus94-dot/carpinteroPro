-- Lifecycle dates belong to the same atomic update as the state transition.
-- This invoker trigger preserves the RPC role, tenant and idempotency checks.
CREATE OR REPLACE FUNCTION public.set_production_order_actual_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    IF NEW.state = 'in_progress' THEN
      NEW.actual_start_date := COALESCE(OLD.actual_start_date, now());
    END IF;
    IF NEW.state IN ('delivered', 'cancelled') THEN
      NEW.actual_end_date := COALESCE(OLD.actual_end_date, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_production_order_actual_dates
BEFORE UPDATE OF state ON public.production_orders
FOR EACH ROW EXECUTE FUNCTION public.set_production_order_actual_dates();

-- Recover dates for existing orders from their immutable audit history.
-- Never invent dates or overwrite an already recorded lifecycle timestamp.
WITH dates AS (
  SELECT production_order_id, workshop_id,
         min(created_at) FILTER (WHERE to_state = 'in_progress') AS started_at,
         min(created_at) FILTER (WHERE to_state IN ('delivered', 'cancelled')) AS ended_at
  FROM public.production_order_events
  GROUP BY production_order_id, workshop_id
)
UPDATE public.production_orders AS orders
SET actual_start_date = COALESCE(orders.actual_start_date, dates.started_at),
    actual_end_date = COALESCE(orders.actual_end_date, dates.ended_at)
FROM dates
WHERE orders.id = dates.production_order_id
  AND orders.workshop_id = dates.workshop_id
  AND ((orders.actual_start_date IS NULL AND dates.started_at IS NOT NULL)
    OR (orders.actual_end_date IS NULL AND dates.ended_at IS NOT NULL));
