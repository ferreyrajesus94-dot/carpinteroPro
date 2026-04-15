// Auto-generated from supabase/migrations — updated manually for Fase 3
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
      workshops: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          workshop_id: string
          display_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          workshop_id: string
          display_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          display_name?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_workshop_id_fkey'
            columns: ['workshop_id']
            referencedRelation: 'workshops'
            referencedColumns: ['id']
          }
        ]
      }
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
      clients: {
        Row: {
          id: string
          workshop_id: string
          name: string
          phone: string | null
          email: string | null
          source: Database['public']['Enums']['client_source']
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workshop_id: string
          name: string
          phone?: string | null
          email?: string | null
          source?: Database['public']['Enums']['client_source']
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          name?: string
          phone?: string | null
          email?: string | null
          source?: Database['public']['Enums']['client_source']
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          id: string
          workshop_id: string
          quote_number: string
          client_id: string | null
          furniture_template_id: string | null
          furniture_name: string
          recipe_cost: number
          status: Database['public']['Enums']['quote_status']
          margin_mode: Database['public']['Enums']['margin_mode']
          margin_pct: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workshop_id: string
          quote_number: string
          client_id?: string | null
          furniture_template_id?: string | null
          furniture_name: string
          recipe_cost?: number
          status?: Database['public']['Enums']['quote_status']
          margin_mode?: Database['public']['Enums']['margin_mode']
          margin_pct?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          quote_number?: string
          client_id?: string | null
          furniture_template_id?: string | null
          furniture_name?: string
          recipe_cost?: number
          status?: Database['public']['Enums']['quote_status']
          margin_mode?: Database['public']['Enums']['margin_mode']
          margin_pct?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'quotes_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quotes_furniture_template_id_fkey'
            columns: ['furniture_template_id']
            isOneToOne: false
            referencedRelation: 'furniture_templates'
            referencedColumns: ['id']
          }
        ]
      }
      quote_extras: {
        Row: {
          id: string
          quote_id: string
          description: string
          amount: number
          show_in_quote: boolean
          sort_order: number
        }
        Insert: {
          id?: string
          quote_id: string
          description: string
          amount?: number
          show_in_quote?: boolean
          sort_order?: number
        }
        Update: {
          id?: string
          quote_id?: string
          description?: string
          amount?: number
          show_in_quote?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'quote_extras_quote_id_fkey'
            columns: ['quote_id']
            isOneToOne: false
            referencedRelation: 'quotes'
            referencedColumns: ['id']
          }
        ]
      }
      contract_templates: {
        Row: {
          id: string
          workshop_id: string
          name: string
          body_markdown: string
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workshop_id: string
          name: string
          body_markdown?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          name?: string
          body_markdown?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workshop_settings: {
        Row: {
          workshop_id: string
          name: string
          logo_url: string | null
          phone: string | null
          email: string | null
          address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          workshop_id: string
          name?: string
          logo_url?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          workshop_id?: string
          name?: string
          logo_url?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_quote_number: {
        Args: { p_workshop_id: string }
        Returns: string
      }
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
      client_source:
        | 'mercadolibre'
        | 'tiendanube'
        | 'instagram'
        | 'facebook'
        | 'otro'
      quote_status:
        | 'presupuesto'
        | 'enviado'
        | 'aprobado'
        | 'en_produccion'
        | 'entregado'
        | 'cancelado'
      margin_mode:
        | 'on_cost'
        | 'on_price'
    }
  }
}
