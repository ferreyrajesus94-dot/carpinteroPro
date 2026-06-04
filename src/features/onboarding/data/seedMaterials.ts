import type { OnboardingMaterialInput } from '../types'

export interface SeedMaterial extends OnboardingMaterialInput {
  description: string
}

export const SEED_MATERIALS: SeedMaterial[] = [
  {
    name: 'Placa MDF 18mm',
    description: '1.83 × 2.60 m — base para muebles de melamina',
    category: 'madera',
    unit: 'un',
    price_per_unit: 45000,
    stock: 0,
    min_stock: 1,
    wood_subtype: 'placa',
    length_cm: 260,
    width_cm: 183,
    thickness_cm: 1.8,
  },
  {
    name: 'Placa Melamina 18mm',
    description: '1.83 × 2.60 m — terminación lista, blanca',
    category: 'madera',
    unit: 'un',
    price_per_unit: 65000,
    stock: 0,
    min_stock: 1,
    wood_subtype: 'placa',
    length_cm: 260,
    width_cm: 183,
    thickness_cm: 1.8,
  },
  {
    name: 'Tornillo aglomerado 4×40',
    description: 'Caja x 100 — fijación general',
    category: 'herraje',
    unit: 'un',
    price_per_unit: 12000,
    stock: 0,
    min_stock: 1,
    pack_size: 100,
  },
  {
    name: 'Cola vinílica',
    description: 'Adhesivo PVA para madera',
    category: 'adhesivo',
    unit: 'ml',
    price_per_unit: 8,
    stock: 0,
    min_stock: 1000,
    volume_ml: 1000,
  },
  {
    name: 'Tapacanto melamínico 22mm',
    description: 'Por metro lineal — terminación de bordes',
    category: 'otro',
    unit: 'm',
    price_per_unit: 350,
    stock: 0,
    min_stock: 5,
  },
]
