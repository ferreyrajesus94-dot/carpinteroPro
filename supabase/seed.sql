-- Demo seed data for CarpinteroPro
-- Workshop ID: 00000000-0000-0000-0000-000000000001

DO $$
DECLARE
  wid uuid := '00000000-0000-0000-0000-000000000001';
  mat_mdf   uuid;
  mat_melamina uuid;
  mat_bisagra  uuid;
  mat_correder uuid;
  mat_laca  uuid;
  mat_tornillo uuid;
BEGIN

  -- =====================
  -- MATERIALES
  -- =====================
  INSERT INTO materials (workshop_id, name, category, unit, price_per_unit, stock, min_stock, notes)
  VALUES (wid, 'MDF 18mm (plancha 2.44x1.22)', 'madera', 'm2', 2800, 25, 10, 'Proveedor: Maderos SA')
  RETURNING id INTO mat_mdf;

  INSERT INTO materials (workshop_id, name, category, unit, price_per_unit, stock, min_stock, notes)
  VALUES (wid, 'Melamina Blanco Nieve 18mm', 'madera', 'm2', 3500, 15, 8, NULL)
  RETURNING id INTO mat_melamina;

  INSERT INTO materials (workshop_id, name, category, unit, price_per_unit, stock, min_stock, notes)
  VALUES (wid, 'Bisagra cazoleta 35mm Blum', 'herraje', 'un', 320, 3, 20, 'Stock crítico — reponer')
  RETURNING id INTO mat_bisagra;

  INSERT INTO materials (workshop_id, name, category, unit, price_per_unit, stock, min_stock, notes)
  VALUES (wid, 'Corredera telescópica 45cm', 'herraje', 'un', 850, 10, 10, NULL)
  RETURNING id INTO mat_correder;

  INSERT INTO materials (workshop_id, name, category, unit, price_per_unit, stock, min_stock, notes)
  VALUES (wid, 'Laca nitrocelulósica blanca', 'pintura', 'l', 1200, 8, 5, 'Secado rápido')
  RETURNING id INTO mat_laca;

  INSERT INTO materials (workshop_id, name, category, unit, price_per_unit, stock, min_stock, notes)
  VALUES (wid, 'Tornillo autoperforante 3.5x25', 'herraje', 'un', 8, 500, 200, NULL)
  RETURNING id INTO mat_tornillo;

  -- =====================
  -- HISTORIAL DE PRECIOS
  -- Simular cambios pasados actualizando el precio (el trigger registra automáticamente
  -- en producción, pero para seed insertamos directamente en price_history)
  -- =====================
  INSERT INTO price_history (material_id, workshop_id, old_price, new_price, changed_at) VALUES
    (mat_mdf,      wid, 2200, 2500, now() - interval '90 days'),
    (mat_mdf,      wid, 2500, 2800, now() - interval '30 days'),
    (mat_melamina, wid, 2800, 3200, now() - interval '60 days'),
    (mat_melamina, wid, 3200, 3500, now() - interval '20 days'),
    (mat_bisagra,  wid, 250,  320,  now() - interval '45 days'),
    (mat_laca,     wid, 900,  1100, now() - interval '75 days'),
    (mat_laca,     wid, 1100, 1200, now() - interval '15 days');

END $$;
