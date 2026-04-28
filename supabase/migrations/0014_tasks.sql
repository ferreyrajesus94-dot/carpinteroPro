-- ============================================================
-- FASE: Lista de tareas del taller
-- ============================================================

CREATE TYPE task_priority AS ENUM ('alta', 'normal', 'baja');
CREATE TYPE task_status   AS ENUM ('pendiente', 'hecha');
CREATE TYPE task_category AS ENUM ('compras', 'produccion', 'administrativo', 'otros');

-- ============================================================
-- Tabla: tasks
-- ============================================================
CREATE TABLE tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id   uuid NOT NULL,
  title         TEXT NOT NULL,
  notes         TEXT,
  due_date      DATE,
  priority      task_priority NOT NULL DEFAULT 'normal',
  category      task_category NOT NULL DEFAULT 'otros',
  status        task_status   NOT NULL DEFAULT 'pendiente',
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tasks_workshop_due_idx    ON tasks (workshop_id, due_date);
CREATE INDEX tasks_workshop_status_idx ON tasks (workshop_id, status);

-- Trigger updated_at
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS con aislamiento por workshop
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workshop_isolation_tasks" ON tasks
  FOR ALL
  USING (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());
