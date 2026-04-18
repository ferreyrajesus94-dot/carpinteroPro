-- 0008_pack_size.sql
-- Permite marcar un material como "comprado en pack de N unidades".
-- El stock y las usage siguen siendo por unidad; el pack es metadata de compra.
-- Pensado para listones de madera, tornillos, bisagras, etc.

alter table materials
  add column pack_size integer
  check (pack_size is null or pack_size > 1);

comment on column materials.pack_size is
  'Si no es null, el material se compra en packs de esta cantidad de unidades. Debe ser > 1. El stock igualmente se maneja en unidades.';
