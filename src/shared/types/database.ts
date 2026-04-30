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
          onboarded_at: string | null
          terms_accepted_at: string | null
          privacy_accepted_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          workshop_id: string
          display_name?: string | null
          onboarded_at?: string | null
          terms_accepted_at?: string | null
          privacy_accepted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          display_name?: string | null
          onboarded_at?: string | null
          terms_accepted_at?: string | null
          privacy_accepted_at?: string | null
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
          wood_subtype: Database['public']['Enums']['wood_subtype'] | null
          length_cm: number | null
          width_cm: number | null
          thickness_cm: number | null
          volume_ml: number | null
          pack_size: number | null
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
          wood_subtype?: Database['public']['Enums']['wood_subtype'] | null
          length_cm?: number | null
          width_cm?: number | null
          thickness_cm?: number | null
          volume_ml?: number | null
          pack_size?: number | null
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
          wood_subtype?: Database['public']['Enums']['wood_subtype'] | null
          length_cm?: number | null
          width_cm?: number | null
          thickness_cm?: number | null
          volume_ml?: number | null
          pack_size?: number | null
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
          category: string | null
          tags: string[]
          height_cm: number | null
          width_cm: number | null
          depth_cm: number | null
          photo_url: string | null
          suggested_margin_pct: number | null
          params: { name: string; default: number }[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workshop_id: string
          name: string
          notes?: string | null
          category?: string | null
          tags?: string[]
          height_cm?: number | null
          width_cm?: number | null
          depth_cm?: number | null
          photo_url?: string | null
          suggested_margin_pct?: number | null
          params?: { name: string; default: number }[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          name?: string
          notes?: string | null
          category?: string | null
          tags?: string[]
          height_cm?: number | null
          width_cm?: number | null
          depth_cm?: number | null
          photo_url?: string | null
          suggested_margin_pct?: number | null
          params?: { name: string; default: number }[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      cut_pieces: {
        Row: {
          id: string
          recipe_item_id: string
          workshop_id: string
          name: string | null
          length_cm: number
          width_cm: number
          quantity: number
          created_at: string
        }
        Insert: {
          id?: string
          recipe_item_id: string
          workshop_id?: string
          name?: string | null
          length_cm: number
          width_cm: number
          quantity?: number
          created_at?: string
        }
        Update: {
          id?: string
          recipe_item_id?: string
          workshop_id?: string
          name?: string | null
          length_cm?: number
          width_cm?: number
          quantity?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cut_pieces_recipe_item_id_fkey'
            columns: ['recipe_item_id']
            isOneToOne: false
            referencedRelation: 'recipe_items'
            referencedColumns: ['id']
          }
        ]
      }
      recipe_items: {
        Row: {
          id: string
          workshop_id: string
          furniture_template_id: string
          material_id: string
          quantity: number
          waste_pct: number
          quantity_formula: string | null
        }
        Insert: {
          id?: string
          workshop_id?: string
          furniture_template_id: string
          material_id: string
          quantity: number
          waste_pct?: number
          quantity_formula?: string | null
        }
        Update: {
          id?: string
          workshop_id?: string
          furniture_template_id?: string
          material_id?: string
          quantity?: number
          waste_pct?: number
          quantity_formula?: string | null
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
      labor_items: {
        Row: {
          id: string
          workshop_id: string
          furniture_template_id: string
          description: string
          hours: number
          rate: number
          created_at: string
        }
        Insert: {
          id?: string
          workshop_id?: string
          furniture_template_id: string
          description: string
          hours: number
          rate: number
          created_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          furniture_template_id?: string
          description?: string
          hours?: number
          rate?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'labor_items_furniture_template_id_fkey'
            columns: ['furniture_template_id']
            isOneToOne: false
            referencedRelation: 'furniture_templates'
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
      tasks: {
        Row: {
          id: string
          workshop_id: string
          title: string
          notes: string | null
          due_date: string | null
          priority: Database['public']['Enums']['task_priority']
          category: Database['public']['Enums']['task_category']
          status: Database['public']['Enums']['task_status']
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workshop_id: string
          title: string
          notes?: string | null
          due_date?: string | null
          priority?: Database['public']['Enums']['task_priority']
          category?: Database['public']['Enums']['task_category']
          status?: Database['public']['Enums']['task_status']
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          title?: string
          notes?: string | null
          due_date?: string | null
          priority?: Database['public']['Enums']['task_priority']
          category?: Database['public']['Enums']['task_category']
          status?: Database['public']['Enums']['task_status']
          completed_at?: string | null
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
          workshop_id: string
          quote_id: string
          description: string
          amount: number
          show_in_quote: boolean
          sort_order: number
        }
        Insert: {
          id?: string
          workshop_id?: string
          quote_id: string
          description: string
          amount?: number
          show_in_quote?: boolean
          sort_order?: number
        }
        Update: {
          id?: string
          workshop_id?: string
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
      quote_recipe_snapshots: {
        Row: {
          id: string
          workshop_id: string
          quote_id: string
          material_id: string | null
          material_name: string
          material_unit: string
          material_category: string
          quantity: number
          waste_pct: number
          price_per_unit: number
          created_at: string
        }
        Insert: {
          id?: string
          workshop_id?: string
          quote_id: string
          material_id?: string | null
          material_name: string
          material_unit: string
          material_category: string
          quantity: number
          waste_pct?: number
          price_per_unit: number
          created_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          quote_id?: string
          material_id?: string | null
          material_name?: string
          material_unit?: string
          material_category?: string
          quantity?: number
          waste_pct?: number
          price_per_unit?: number
          created_at?: string
        }
        Relationships: []
      }
      quote_labor_snapshots: {
        Row: {
          id: string
          workshop_id: string
          quote_id: string
          description: string
          hours: number
          rate: number
          created_at: string
        }
        Insert: {
          id?: string
          workshop_id?: string
          quote_id: string
          description: string
          hours: number
          rate: number
          created_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          quote_id?: string
          description?: string
          hours?: number
          rate?: number
          created_at?: string
        }
        Relationships: []
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
          auto_stock_discount: boolean
          default_labor_rate: number | null
          stock_alert_enabled: boolean
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
          auto_stock_discount?: boolean
          default_labor_rate?: number | null
          stock_alert_enabled?: boolean
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
          auto_stock_discount?: boolean
          default_labor_rate?: number | null
          stock_alert_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          id: string
          workshop_id: string
          material_id: string
          delta: number
          reason: Database['public']['Enums']['stock_movement_reason']
          note: string | null
          quote_id: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          workshop_id: string
          material_id: string
          delta: number
          reason: Database['public']['Enums']['stock_movement_reason']
          note?: string | null
          quote_id?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          workshop_id?: string
          material_id?: string
          delta?: number
          reason?: Database['public']['Enums']['stock_movement_reason']
          note?: string | null
          quote_id?: string | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'stock_movements_material_id_fkey'
            columns: ['material_id']
            isOneToOne: false
            referencedRelation: 'materials'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_movements_quote_id_fkey'
            columns: ['quote_id']
            isOneToOne: false
            referencedRelation: 'quotes'
            referencedColumns: ['id']
          }
        ]
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
      apply_stock_movement: {
        Args: {
          p_material_id: string
          p_delta: number
          p_reason: Database['public']['Enums']['stock_movement_reason']
          p_note?: string | null
          p_quote_id?: string | null
        }
        Returns: number
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
      wood_subtype:
        | 'placa'
        | 'liston'
        | 'tirante'
        | 'columna'
      stock_movement_reason:
        | 'compra'
        | 'consumo'
        | 'merma'
        | 'ajuste'
        | 'descuento_presupuesto'
      task_priority:
        | 'alta'
        | 'normal'
        | 'baja'
      task_status:
        | 'pendiente'
        | 'hecha'
      task_category:
        | 'compras'
        | 'produccion'
        | 'administrativo'
        | 'otros'
    }
  }
}
