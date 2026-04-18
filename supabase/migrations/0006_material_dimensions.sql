-- 0006: Dimensiones físicas y volumen por envase para materiales.
-- Permite que la sección Muebles calcule, a futuro, m² (placas) o
-- metros lineales (listón/tirante/columna) consumidos por cada mueble.

CREATE TYPE wood_subtype AS ENUM ('placa', 'liston', 'tirante', 'columna');

ALTER TABLE materials
  ADD COLUMN wood_subtype  wood_subtype,
  ADD COLUMN length_cm     NUMERIC(10, 2) CHECK (length_cm    IS NULL OR length_cm    > 0),
  ADD COLUMN width_cm      NUMERIC(10, 2) CHECK (width_cm     IS NULL OR width_cm     > 0),
  ADD COLUMN thickness_cm  NUMERIC(10, 2) CHECK (thickness_cm IS NULL OR thickness_cm > 0),
  ADD COLUMN volume_ml     NUMERIC(10, 2) CHECK (volume_ml    IS NULL OR volume_ml    > 0);

COMMENT ON COLUMN materials.wood_subtype IS
  'Solo aplica si category=madera. Define si el cálculo en muebles usa m² (placa) o metros lineales (listón/tirante/columna).';
COMMENT ON COLUMN materials.volume_ml IS
  'Volumen por envase para líquidos (pintura/adhesivo). Ej: lata de 4 L = 4000.';
