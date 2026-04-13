// Auto-generated from supabase/migrations/0001_init.sql
// Re-generate with: SUPABASE_ACCESS_TOKEN=<sbp_token> npx supabase gen types typescript --project-id revbbzqjglqnphjrasvv > src/shared/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      materials: {
        Row: {
          id: string
          workshop_id: string
          name: string
          category: Database['public']['Enums']['material_category']
          unit: Database['public']['Enums']['unit_of_measure']
          price_per_unit: number
          stock: number
          min_stock: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workshop_id: string
          name: string
          category?: Database['public']['Enums']['material_category']
          unit?: Database['public']['Enums']['unit_of_measure']
          price_per_unit?: number
          stock?: number
          min_stock?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          name?: string
          category?: Database['public']['Enums']['material_category']
          unit?: Database['public']['Enums']['unit_of_measure']
          price_per_unit?: number
          stock?: number
          min_stock?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          id: string
          material_id: string
          workshop_id: string
          old_price: number
          new_price: number
          changed_at: string
        }
        Insert: {
          id?: string
          material_id: string
          workshop_id: string
          old_price: number
          new_price: number
          changed_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          workshop_id?: string
          old_price?: number
          new_price?: number
          changed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'price_history_material_id_fkey'
            columns: ['material_id']
            isOneToOne: false
            referencedRelation: 'materials'
            referencedColumns: ['id']
          }
        ]
      }
      furniture_templates: {
        Row: {
          id: string
          workshop_id: string
          name: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workshop_id: string
          name: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          name?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recipe_items: {
        Row: {
          id: string
          furniture_template_id: string
          material_id: string
          quantity: number
        }
        Insert: {
          id?: string
          furniture_template_id: string
          material_id: string
          quantity: number
        }
        Update: {
          id?: string
          furniture_template_id?: string
          material_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: 'recipe_items_furniture_template_id_fkey'
            columns: ['furniture_template_id']
            isOneToOne: false
            referencedRelation: 'furniture_templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recipe_items_material_id_fkey'
            columns: ['material_id']
            isOneToOne: false
            referencedRelation: 'materials'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      material_category:
        | 'madera'
        | 'herraje'
        | 'pintura'
        | 'adhesivo'
        | 'vidrio'
        | 'tela'
        | 'otro'
      unit_of_measure:
        | 'ml'
        | 'l'
        | 'g'
        | 'kg'
        | 'cm'
        | 'm'
        | 'cm2'
        | 'm2'
        | 'cm3'
        | 'm3'
        | 'un'
    }
  }
}
