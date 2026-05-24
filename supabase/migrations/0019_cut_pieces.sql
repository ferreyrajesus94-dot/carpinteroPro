-- Fase 7: piezas a cortar por ítem de receta
-- Permite definir piezas individuales (largo × ancho × cantidad) para materiales de tipo placa.
-- La tabla sigue a recipe_items por CASCADE; si el ítem se borra, las piezas también.

CREATE TABLE cut_pieces (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_item_id  uuid        NOT NULL REFERENCES recipe_items(id) ON DELETE CASCADE,
  workshop_id     uuid        NOT NULL,
  name            text,
  length_cm       numeric(10,2) NOT NULL CHECK (length_cm > 0),
  width_cm        numeric(10,2) NOT NULL CHECK (width_cm > 0),
  quantity        integer     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE cut_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY cut_pieces_workshop_policy ON cut_pieces
  USING  (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());

-- Auto-rellena workshop_id desde recipe_items para que el trigger sea transparente
CREATE OR REPLACE FUNCTION fill_cut_piece_workshop_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.workshop_id IS NULL OR NEW.workshop_id = '00000000-0000-0000-0000-000000000000' THEN
    SELECT ri.workshop_id INTO NEW.workshop_id
    FROM recipe_items ri
    WHERE ri.id = NEW.recipe_item_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fill_cut_piece_workshop_id
  BEFORE INSERT ON cut_pieces
  FOR EACH ROW EXECUTE FUNCTION fill_cut_piece_workshop_id();
