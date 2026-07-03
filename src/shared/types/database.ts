// Auto-generated from supabase/migrations — updated manually for Fase 3
// Re-generate with: SUPABASE_ACCESS_TOKEN=<sbp_token> npx supabase gen types typescript --project-id revbbzqjglqnphjrasvv > src/shared/types/database.ts

export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	public: {
		Tables: {
			youtubers: {
				Row: {
					id: string;
					display_name: string;
					channel_url: string | null;
					contact_email: string | null;
					payout_method: string | null;
					payout_cbu: string | null;
					payout_cvu: string | null;
					payout_alias: string | null;
					payout_bank_name: string | null;
					payout_holder_name: string | null;
					payout_holder_cuit: string | null;
					is_active: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					display_name: string;
					channel_url?: string | null;
					contact_email?: string | null;
					payout_method?: string | null;
					payout_cbu?: string | null;
					payout_cvu?: string | null;
					payout_alias?: string | null;
					payout_bank_name?: string | null;
					payout_holder_name?: string | null;
					payout_holder_cuit?: string | null;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					display_name?: string;
					channel_url?: string | null;
					contact_email?: string | null;
					payout_method?: string | null;
					payout_cbu?: string | null;
					payout_cvu?: string | null;
					payout_alias?: string | null;
					payout_bank_name?: string | null;
					payout_holder_name?: string | null;
					payout_holder_cuit?: string | null;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			referral_codes: {
				Row: {
					id: string;
					youtuber_id: string;
					code: string;
					discount_pct: number;
					commission_pct: number;
					is_active: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					youtuber_id: string;
					code: string;
					discount_pct: number;
					commission_pct: number;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					youtuber_id?: string;
					code?: string;
					discount_pct?: number;
					commission_pct?: number;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			workshop_referrals: {
				Row: {
					workshop_id: string;
					referral_code_id: string;
					youtuber_id: string;
					attributed_at: string;
				};
				Insert: {
					workshop_id: string;
					referral_code_id: string;
					youtuber_id: string;
					attributed_at?: string;
				};
				Update: {
					workshop_id?: string;
					referral_code_id?: string;
					youtuber_id?: string;
					attributed_at?: string;
				};
				Relationships: [];
			};
			referral_commissions: {
				Row: {
					id: string;
					workshop_id: string;
					youtuber_id: string;
					referral_code_id: string;
					subscription_id: string | null;
					provider_payment_id: string;
					payment_amount: number;
					commission_pct: number;
					commission_amount: number;
					currency: string;
					status: string;
					paid_at: string | null;
					payout_reference: string | null;
					payout_run_id: string | null;
					occurred_at: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					workshop_id: string;
					youtuber_id: string;
					referral_code_id: string;
					subscription_id?: string | null;
					provider_payment_id: string;
					payment_amount: number;
					commission_pct: number;
					commission_amount: number;
					currency?: string;
					status?: string;
					paid_at?: string | null;
					payout_reference?: string | null;
					payout_run_id?: string | null;
					occurred_at: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					youtuber_id?: string;
					referral_code_id?: string;
					subscription_id?: string | null;
					provider_payment_id?: string;
					payment_amount?: number;
					commission_pct?: number;
					commission_amount?: number;
					currency?: string;
					status?: string;
					paid_at?: string | null;
					payout_reference?: string | null;
					payout_run_id?: string | null;
					occurred_at?: string;
					created_at?: string;
				};
				Relationships: [];
			};
			workshops: {
				Row: {
					id: string;
					name: string;
					created_at: string;
					is_active: boolean;
				};
				Insert: {
					id?: string;
					name: string;
					created_at?: string;
					is_active?: boolean;
				};
				Update: {
					id?: string;
					name?: string;
					created_at?: string;
					is_active?: boolean;
				};
				Relationships: [];
			};
			profiles: {
				Row: {
					id: string;
					workshop_id: string;
					workshop_role: Database["public"]["Enums"]["workshop_user_role"];
					display_name: string | null;
					onboarded_at: string | null;
					is_platform_admin: boolean;
					terms_accepted_at: string | null;
					privacy_accepted_at: string | null;
					created_at: string;
				};
				Insert: {
					id: string;
					workshop_id: string;
					workshop_role?: Database["public"]["Enums"]["workshop_user_role"];
					display_name?: string | null;
					onboarded_at?: string | null;
					is_platform_admin?: boolean;
					terms_accepted_at?: string | null;
					privacy_accepted_at?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					workshop_role?: Database["public"]["Enums"]["workshop_user_role"];
					display_name?: string | null;
					onboarded_at?: string | null;
					is_platform_admin?: boolean;
					terms_accepted_at?: string | null;
					privacy_accepted_at?: string | null;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "profiles_workshop_id_fkey";
						columns: ["workshop_id"];
						referencedRelation: "workshops";
						referencedColumns: ["id"];
					},
				];
			};
			subscriptions: {
				Row: {
					id: string;
					workshop_id: string;
					status: "trialing" | "active" | "past_due" | "unpaid" | "cancelled";
					plan: string;
					provider: string;
					trial_starts_at: string | null;
					trial_ends_at: string | null;
					current_period_starts_at: string | null;
					current_period_ends_at: string | null;
					provider_subscription_id: string | null;
					provider_preapproval_id: string | null;
					provider_status: string | null;
					cancel_at_period_end: boolean;
					cancelled_at: string | null;
					first_period_discount_pct: number | null;
					referred_by_referral_code_id: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					workshop_id: string;
					status: "trialing" | "active" | "past_due" | "unpaid" | "cancelled";
					plan?: string;
					provider?: string;
					trial_starts_at?: string | null;
					trial_ends_at?: string | null;
					current_period_starts_at?: string | null;
					current_period_ends_at?: string | null;
					provider_subscription_id?: string | null;
					provider_preapproval_id?: string | null;
					provider_status?: string | null;
					cancel_at_period_end?: boolean;
					cancelled_at?: string | null;
					first_period_discount_pct?: number | null;
					referred_by_referral_code_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					status?: "trialing" | "active" | "past_due" | "unpaid" | "cancelled";
					plan?: string;
					provider?: string;
					trial_starts_at?: string | null;
					trial_ends_at?: string | null;
					current_period_starts_at?: string | null;
					current_period_ends_at?: string | null;
					provider_subscription_id?: string | null;
					provider_preapproval_id?: string | null;
					provider_status?: string | null;
					cancel_at_period_end?: boolean;
					cancelled_at?: string | null;
					first_period_discount_pct?: number | null;
					referred_by_referral_code_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			billing_webhook_events: {
				Row: {
					id: string;
					provider: string;
					provider_event_id: string;
					event_type: string;
					provider_resource_id: string | null;
					workshop_id: string;
					processed_at: string;
					payload: Json;
					updated_at: string;
				};
				Insert: {
					id?: string;
					provider?: string;
					provider_event_id: string;
					event_type: string;
					provider_resource_id?: string | null;
					workshop_id: string;
					processed_at?: string;
					payload?: Json;
					updated_at?: string;
				};
				Update: {
					id?: string;
					provider?: string;
					provider_event_id?: string;
					event_type?: string;
					provider_resource_id?: string | null;
					workshop_id?: string;
					processed_at?: string;
					payload?: Json;
					updated_at?: string;
				};
				Relationships: [];
			};
			materials: {
				Row: {
					id: string;
					workshop_id: string;
					name: string;
					category: Database["public"]["Enums"]["material_category"];
					unit: Database["public"]["Enums"]["unit_of_measure"];
					price_per_unit: number;
					stock: number;
					min_stock: number;
					notes: string | null;
					wood_subtype: Database["public"]["Enums"]["wood_subtype"] | null;
					length_cm: number | null;
					width_cm: number | null;
					thickness_cm: number | null;
					volume_ml: number | null;
					pack_size: number | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					workshop_id: string;
					name: string;
					category?: Database["public"]["Enums"]["material_category"];
					unit?: Database["public"]["Enums"]["unit_of_measure"];
					price_per_unit?: number;
					stock?: number;
					min_stock?: number;
					notes?: string | null;
					wood_subtype?: Database["public"]["Enums"]["wood_subtype"] | null;
					length_cm?: number | null;
					width_cm?: number | null;
					thickness_cm?: number | null;
					volume_ml?: number | null;
					pack_size?: number | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					name?: string;
					category?: Database["public"]["Enums"]["material_category"];
					unit?: Database["public"]["Enums"]["unit_of_measure"];
					price_per_unit?: number;
					stock?: number;
					min_stock?: number;
					notes?: string | null;
					wood_subtype?: Database["public"]["Enums"]["wood_subtype"] | null;
					length_cm?: number | null;
					width_cm?: number | null;
					thickness_cm?: number | null;
					volume_ml?: number | null;
					pack_size?: number | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			price_history: {
				Row: {
					id: string;
					material_id: string;
					workshop_id: string;
					old_price: number;
					new_price: number;
					changed_at: string;
				};
				Insert: {
					id?: string;
					material_id: string;
					workshop_id: string;
					old_price: number;
					new_price: number;
					changed_at?: string;
				};
				Update: {
					id?: string;
					material_id?: string;
					workshop_id?: string;
					old_price?: number;
					new_price?: number;
					changed_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "price_history_material_id_fkey";
						columns: ["material_id"];
						isOneToOne: false;
						referencedRelation: "materials";
						referencedColumns: ["id"];
					},
				];
			};
			furniture_templates: {
				Row: {
					id: string;
					workshop_id: string;
					name: string;
					notes: string | null;
					category: string | null;
					tags: string[];
					height_cm: number | null;
					width_cm: number | null;
					depth_cm: number | null;
					photo_url: string | null;
					suggested_margin_pct: number | null;
					params: { name: string; default: number }[];
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					workshop_id: string;
					name: string;
					notes?: string | null;
					category?: string | null;
					tags?: string[];
					height_cm?: number | null;
					width_cm?: number | null;
					depth_cm?: number | null;
					photo_url?: string | null;
					suggested_margin_pct?: number | null;
					params?: { name: string; default: number }[];
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					name?: string;
					notes?: string | null;
					category?: string | null;
					tags?: string[];
					height_cm?: number | null;
					width_cm?: number | null;
					depth_cm?: number | null;
					photo_url?: string | null;
					suggested_margin_pct?: number | null;
					params?: { name: string; default: number }[];
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			cut_pieces: {
				Row: {
					id: string;
					recipe_item_id: string;
					workshop_id: string;
					name: string | null;
					length_cm: number;
					width_cm: number;
					quantity: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					recipe_item_id: string;
					workshop_id?: string;
					name?: string | null;
					length_cm: number;
					width_cm: number;
					quantity?: number;
					created_at?: string;
				};
				Update: {
					id?: string;
					recipe_item_id?: string;
					workshop_id?: string;
					name?: string | null;
					length_cm?: number;
					width_cm?: number;
					quantity?: number;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "cut_pieces_recipe_item_id_fkey";
						columns: ["recipe_item_id"];
						isOneToOne: false;
						referencedRelation: "recipe_items";
						referencedColumns: ["id"];
					},
				];
			};
			recipe_items: {
				Row: {
					id: string;
					workshop_id: string;
					furniture_template_id: string;
					material_id: string;
					quantity: number;
					waste_pct: number;
					quantity_formula: string | null;
				};
				Insert: {
					id?: string;
					workshop_id?: string;
					furniture_template_id: string;
					material_id: string;
					quantity: number;
					waste_pct?: number;
					quantity_formula?: string | null;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					furniture_template_id?: string;
					material_id?: string;
					quantity?: number;
					waste_pct?: number;
					quantity_formula?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "recipe_items_furniture_template_id_fkey";
						columns: ["furniture_template_id"];
						isOneToOne: false;
						referencedRelation: "furniture_templates";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "recipe_items_material_id_fkey";
						columns: ["material_id"];
						isOneToOne: false;
						referencedRelation: "materials";
						referencedColumns: ["id"];
					},
				];
			};
			labor_items: {
				Row: {
					id: string;
					workshop_id: string;
					furniture_template_id: string;
					description: string;
					hours: number;
					rate: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					workshop_id?: string;
					furniture_template_id: string;
					description: string;
					hours: number;
					rate: number;
					created_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					furniture_template_id?: string;
					description?: string;
					hours?: number;
					rate?: number;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "labor_items_furniture_template_id_fkey";
						columns: ["furniture_template_id"];
						isOneToOne: false;
						referencedRelation: "furniture_templates";
						referencedColumns: ["id"];
					},
				];
			};
			clients: {
				Row: {
					id: string;
					workshop_id: string;
					name: string;
					phone: string | null;
					email: string | null;
					source: Database["public"]["Enums"]["client_source"];
					notes: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					workshop_id: string;
					name: string;
					phone?: string | null;
					email?: string | null;
					source?: Database["public"]["Enums"]["client_source"];
					notes?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					name?: string;
					phone?: string | null;
					email?: string | null;
					source?: Database["public"]["Enums"]["client_source"];
					notes?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			tasks: {
				Row: {
					id: string;
					workshop_id: string;
					title: string;
					notes: string | null;
					due_date: string | null;
					priority: Database["public"]["Enums"]["task_priority"];
					category: Database["public"]["Enums"]["task_category"];
					status: Database["public"]["Enums"]["task_status"];
					completed_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					workshop_id: string;
					title: string;
					notes?: string | null;
					due_date?: string | null;
					priority?: Database["public"]["Enums"]["task_priority"];
					category?: Database["public"]["Enums"]["task_category"];
					status?: Database["public"]["Enums"]["task_status"];
					completed_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					title?: string;
					notes?: string | null;
					due_date?: string | null;
					priority?: Database["public"]["Enums"]["task_priority"];
					category?: Database["public"]["Enums"]["task_category"];
					status?: Database["public"]["Enums"]["task_status"];
					completed_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			quotes: {
				Row: {
					id: string;
					workshop_id: string;
					quote_number: string;
					client_id: string | null;
					furniture_template_id: string | null;
					furniture_name: string;
					recipe_cost: number;
					status: Database["public"]["Enums"]["quote_status"];
					margin_mode: Database["public"]["Enums"]["margin_mode"];
					margin_pct: number;
					notes: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					workshop_id: string;
					quote_number: string;
					client_id?: string | null;
					furniture_template_id?: string | null;
					furniture_name: string;
					recipe_cost?: number;
					status?: Database["public"]["Enums"]["quote_status"];
					margin_mode?: Database["public"]["Enums"]["margin_mode"];
					margin_pct?: number;
					notes?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					quote_number?: string;
					client_id?: string | null;
					furniture_template_id?: string | null;
					furniture_name?: string;
					recipe_cost?: number;
					status?: Database["public"]["Enums"]["quote_status"];
					margin_mode?: Database["public"]["Enums"]["margin_mode"];
					margin_pct?: number;
					notes?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "quotes_client_id_fkey";
						columns: ["client_id"];
						isOneToOne: false;
						referencedRelation: "clients";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "quotes_furniture_template_id_fkey";
						columns: ["furniture_template_id"];
						isOneToOne: false;
						referencedRelation: "furniture_templates";
						referencedColumns: ["id"];
					},
				];
			};
			quote_extras: {
				Row: {
					id: string;
					workshop_id: string;
					quote_id: string;
					description: string;
					amount: number;
					show_in_quote: boolean;
					sort_order: number;
				};
				Insert: {
					id?: string;
					workshop_id?: string;
					quote_id: string;
					description: string;
					amount?: number;
					show_in_quote?: boolean;
					sort_order?: number;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					quote_id?: string;
					description?: string;
					amount?: number;
					show_in_quote?: boolean;
					sort_order?: number;
				};
				Relationships: [
					{
						foreignKeyName: "quote_extras_quote_id_fkey";
						columns: ["quote_id"];
						isOneToOne: false;
						referencedRelation: "quotes";
						referencedColumns: ["id"];
					},
				];
			};
			quote_recipe_snapshots: {
				Row: {
					id: string;
					workshop_id: string;
					quote_id: string;
					material_id: string | null;
					material_name: string;
					material_unit: string;
					material_category: string;
					quantity: number;
					waste_pct: number;
					price_per_unit: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					workshop_id?: string;
					quote_id: string;
					material_id?: string | null;
					material_name: string;
					material_unit: string;
					material_category: string;
					quantity: number;
					waste_pct?: number;
					price_per_unit: number;
					created_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					quote_id?: string;
					material_id?: string | null;
					material_name?: string;
					material_unit?: string;
					material_category?: string;
					quantity?: number;
					waste_pct?: number;
					price_per_unit?: number;
					created_at?: string;
				};
				Relationships: [];
			};
			quote_labor_snapshots: {
				Row: {
					id: string;
					workshop_id: string;
					quote_id: string;
					description: string;
					hours: number;
					rate: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					workshop_id?: string;
					quote_id: string;
					description: string;
					hours: number;
					rate: number;
					created_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					quote_id?: string;
					description?: string;
					hours?: number;
					rate?: number;
					created_at?: string;
				};
				Relationships: [];
			};
			contract_templates: {
				Row: {
					id: string;
					workshop_id: string;
					name: string;
					body_markdown: string;
					is_default: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					workshop_id: string;
					name: string;
					body_markdown?: string;
					is_default?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					name?: string;
					body_markdown?: string;
					is_default?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			workshop_settings: {
				Row: {
					workshop_id: string;
					name: string;
					logo_url: string | null;
					phone: string | null;
					email: string | null;
					address: string | null;
					auto_stock_discount: boolean;
					default_labor_rate: number | null;
					stock_alert_enabled: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					workshop_id: string;
					name?: string;
					logo_url?: string | null;
					phone?: string | null;
					email?: string | null;
					address?: string | null;
					auto_stock_discount?: boolean;
					default_labor_rate?: number | null;
					stock_alert_enabled?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					workshop_id?: string;
					name?: string;
					logo_url?: string | null;
					phone?: string | null;
					email?: string | null;
					address?: string | null;
					auto_stock_discount?: boolean;
					default_labor_rate?: number | null;
					stock_alert_enabled?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			stock_movements: {
				Row: {
					id: string;
					workshop_id: string;
					material_id: string;
					delta: number;
					reason: Database["public"]["Enums"]["stock_movement_reason"];
					note: string | null;
					quote_id: string | null;
					created_at: string;
					created_by: string | null;
					reversal_of_movement_id: string | null;
					reversal_reason: string | null;
					reversed_original_reason:
						| Database["public"]["Enums"]["stock_movement_reason"]
						| null;
					reversal_request_id: string | null;
					production_deduction_id: string | null;
				};
				Insert: {
					id?: string;
					workshop_id: string;
					material_id: string;
					delta: number;
					reason: Database["public"]["Enums"]["stock_movement_reason"];
					note?: string | null;
					quote_id?: string | null;
					created_at?: string;
					created_by?: string | null;
					reversal_of_movement_id?: string | null;
					reversal_reason?: string | null;
					reversed_original_reason?:
						| Database["public"]["Enums"]["stock_movement_reason"]
						| null;
					reversal_request_id?: string | null;
					production_deduction_id?: string | null;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					material_id?: string;
					delta?: number;
					reason?: Database["public"]["Enums"]["stock_movement_reason"];
					note?: string | null;
					quote_id?: string | null;
					created_at?: string;
					created_by?: string | null;
					reversal_of_movement_id?: string | null;
					reversal_reason?: string | null;
					reversed_original_reason?:
						| Database["public"]["Enums"]["stock_movement_reason"]
						| null;
					reversal_request_id?: string | null;
					production_deduction_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "stock_movements_material_id_fkey";
						columns: ["material_id"];
						isOneToOne: false;
						referencedRelation: "materials";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "stock_movements_quote_id_fkey";
						columns: ["quote_id"];
						isOneToOne: false;
						referencedRelation: "quotes";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "stock_movements_reversal_of_movement_id_fkey";
						columns: ["reversal_of_movement_id"];
						isOneToOne: false;
						referencedRelation: "stock_movements";
						referencedColumns: ["id"];
					},
				];
			};
			platform_settings: {
				Row: {
					key: string;
					value: Json;
					updated_at: string;
				};
				Insert: {
					key: string;
					value?: Json;
					updated_at?: string;
				};
				Update: {
					key?: string;
					value?: Json;
					updated_at?: string;
				};
				Relationships: [];
			};
			payout_runs: {
				Row: {
					id: string;
					created_by: string;
					total_amount: number;
					commission_count: number;
					reference: string | null;
					notes: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					created_by: string;
					total_amount: number;
					commission_count: number;
					reference?: string | null;
					notes?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					created_by?: string;
					total_amount?: number;
					commission_count?: number;
					reference?: string | null;
					notes?: string | null;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "payout_runs_created_by_fkey";
						columns: ["created_by"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			quote_approved_bom_lines: {
				Row: {
					id: string;
					workshop_id: string;
					quote_id: string;
					line_number: number;
					source_recipe_snapshot_id: string | null;
					material_id: string | null;
					material_name: string;
					material_unit: string;
					material_category: string;
					deduction_quantity: number | null;
					calculation_method: string;
					is_complete: boolean;
					warning_code: string | null;
					calculation_context: Json;
					created_at: string;
				};
				Insert: {
					id?: string;
					workshop_id: string;
					quote_id: string;
					line_number: number;
					source_recipe_snapshot_id?: string | null;
					material_id?: string | null;
					material_name: string;
					material_unit: string;
					material_category: string;
					deduction_quantity?: number | null;
					calculation_method: string;
					is_complete?: boolean;
					warning_code?: string | null;
					calculation_context?: Json;
					created_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					quote_id?: string;
					line_number?: number;
					source_recipe_snapshot_id?: string | null;
					material_id?: string | null;
					material_name?: string;
					material_unit?: string;
					material_category?: string;
					deduction_quantity?: number | null;
					calculation_method?: string;
					is_complete?: boolean;
					warning_code?: string | null;
					calculation_context?: Json;
					created_at?: string;
				};
				Relationships: [];
			};
			quote_production_stock_deductions: {
				Row: {
					id: string;
					workshop_id: string;
					quote_id: string;
					request_id: string | null;
					status: string;
					auto_stock_discount_enabled: boolean;
					snapshot_incomplete: boolean;
					shortage_detected: boolean;
					warning_summary: Json;
					confirmed_by: string | null;
					confirmed_at: string;
					reversed_by: string | null;
					reversed_at: string | null;
					reversal_reason: string | null;
					reversal_request_id: string | null;
					// PR 4: nullable FK to production_orders.id. The new flow
					// (start_production_order) writes a non-null value. Legacy
					// batches (created via the legacy start_quote_production RPC)
					// keep production_order_id = NULL per the spec "Legacy batch
					// keeps null" scenario. ON DELETE SET NULL so deleting a
					// production order does not cascade to legacy ledger rows.
					production_order_id: string | null;
				};
				Insert: {
					id?: string;
					workshop_id: string;
					quote_id: string;
					request_id?: string | null;
					status?: string;
					auto_stock_discount_enabled: boolean;
					snapshot_incomplete?: boolean;
					shortage_detected?: boolean;
					warning_summary?: Json;
					confirmed_by?: string | null;
					confirmed_at?: string;
					reversed_by?: string | null;
					reversed_at?: string | null;
					reversal_reason?: string | null;
					reversal_request_id?: string | null;
					production_order_id?: string | null;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					quote_id?: string;
					request_id?: string | null;
					status?: string;
					auto_stock_discount_enabled?: boolean;
					snapshot_incomplete?: boolean;
					shortage_detected?: boolean;
					warning_summary?: Json;
					confirmed_by?: string | null;
					confirmed_at?: string;
					reversed_by?: string | null;
					reversed_at?: string | null;
					reversal_reason?: string | null;
					reversal_request_id?: string | null;
					production_order_id?: string | null;
				};
				Relationships: [];
			};
			// PR 1: first-class production orders. State machine is owned by
			// SQL (start_production_order, transition_production_order_state
			// RPCs land in PR 2). RLS exposes only a SELECT policy scoped by
			// get_current_workshop_id(); no INSERT/UPDATE/DELETE policies exist
			// for authenticated users. Defense-in-depth triggers reject
			// authenticated mutations with SQLSTATE 42501 UNLESS the
			// transaction-local guard `app.production_order_write_context
			// = 'rpc'` is set by a PR-2 SECURITY DEFINER RPC after its own
			// role and workshop checks.
			production_orders: {
				Row: {
					id: string;
					workshop_id: string;
					quote_id: string;
					production_number: string;
					state: Database["public"]["Enums"]["production_order_state"];
					planned_start_date: string | null;
					planned_end_date: string | null;
					actual_start_date: string | null;
					actual_end_date: string | null;
					assigned_to: string | null;
					notes: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					workshop_id: string;
					quote_id: string;
					production_number: string;
					state?: Database["public"]["Enums"]["production_order_state"];
					planned_start_date?: string | null;
					planned_end_date?: string | null;
					actual_start_date?: string | null;
					actual_end_date?: string | null;
					assigned_to?: string | null;
					notes?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					quote_id?: string;
					production_number?: string;
					state?: Database["public"]["Enums"]["production_order_state"];
					planned_start_date?: string | null;
					planned_end_date?: string | null;
					actual_start_date?: string | null;
					actual_end_date?: string | null;
					assigned_to?: string | null;
					notes?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			// PR 1: append-only audit log of production_order state
			// transitions. RLS exposes only a SELECT policy scoped by
			// get_current_workshop_id(); no INSERT/UPDATE/DELETE policies
			// exist for authenticated users. Defense-in-depth triggers
			// reject authenticated mutations with SQLSTATE 42501 UNLESS
			// the transaction-local guard `app.production_order_write_context
			// = 'rpc'` is set by a PR-2 SECURITY DEFINER RPC. The PR-2
			// transition_production_order_state RPC is the only sanctioned
			// writer. from_state is NULL for the creation event and set for
			// every subsequent transition.
			production_order_events: {
				Row: {
					id: string;
					workshop_id: string;
					production_order_id: string;
					// PR 7: the canonical UI label (one of created /
					// transitioned / paused / resumed / cancelled /
					// delivered). NOT NULL.
					event_type: string;
					from_state:
						| Database["public"]["Enums"]["production_order_state"]
						| null;
					to_state: Database["public"]["Enums"]["production_order_state"];
					// Legacy column: kept for back-compat.
					reason: string | null;
					// PR 7: human note attached to the event.
					note: string | null;
					actor_id: string | null;
					metadata: Json | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					workshop_id: string;
					production_order_id: string;
					// PR 7: optional — auto-derived from (from_state,
					// to_state) by the BEFORE INSERT trigger when the
					// caller omits it. The write RPCs set it explicitly.
					event_type?: string;
					from_state?:
						| Database["public"]["Enums"]["production_order_state"]
						| null;
					to_state: Database["public"]["Enums"]["production_order_state"];
					reason?: string | null;
					note?: string | null;
					actor_id?: string | null;
					metadata?: Json | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					workshop_id?: string;
					production_order_id?: string;
					event_type?: string;
					from_state?:
						| Database["public"]["Enums"]["production_order_state"]
						| null;
					to_state?: Database["public"]["Enums"]["production_order_state"];
					reason?: string | null;
					note?: string | null;
					actor_id?: string | null;
					metadata?: Json | null;
					created_at?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			generate_quote_number: {
				Args: { p_workshop_id: string };
				Returns: string;
			};
			capture_quote_approved_bom: {
				Args: { p_quote_id: string };
				Returns: undefined;
			};
			apply_stock_movement: {
				Args: {
					p_material_id: string;
					p_delta: number;
					p_reason: Database["public"]["Enums"]["stock_movement_reason"];
					p_note?: string | null;
					p_quote_id?: string | null;
				};
				Returns: number;
			};
			get_stock_movement_ledger: {
				Args: {
					p_reason?:
						| Database["public"]["Enums"]["stock_movement_reason"]
						| null;
					p_material_id?: string | null;
					p_creator_id?: string | null;
					p_from?: string | null;
					p_to?: string | null;
					p_search?: string | null;
					p_limit?: number | null;
					p_offset?: number | null;
				};
				Returns: {
					id: string;
					workshop_id: string;
					material_id: string;
					material_name: string;
					material_unit: Database["public"]["Enums"]["unit_of_measure"];
					delta: number;
					reason: Database["public"]["Enums"]["stock_movement_reason"];
					note: string | null;
					quote_id: string | null;
					quote_number: string | null;
					created_at: string;
					created_by: string | null;
					creator_name: string | null;
					reversal_of_movement_id: string | null;
					reversal_reason: string | null;
					reversed_original_reason:
						| Database["public"]["Enums"]["stock_movement_reason"]
						| null;
					is_reversal: boolean;
					reversed_by_movement_id: string | null;
					production_deduction_id: string | null;
					is_production_deduction: boolean;
					production_deduction_status: string | null;
				}[];
			};
			get_stock_movement_detail: {
				Args: { p_movement_id: string };
				Returns: {
					id: string;
					workshop_id: string;
					material_id: string;
					material_name: string;
					material_unit: Database["public"]["Enums"]["unit_of_measure"];
					delta: number;
					reason: Database["public"]["Enums"]["stock_movement_reason"];
					note: string | null;
					quote_id: string | null;
					quote_number: string | null;
					created_at: string;
					created_by: string | null;
					creator_name: string | null;
					reversal_of_movement_id: string | null;
					reversal_reason: string | null;
					reversed_original_reason:
						| Database["public"]["Enums"]["stock_movement_reason"]
						| null;
					reversal_request_id: string | null;
					is_reversal: boolean;
					reversed_by_movement_id: string | null;
					can_reverse: boolean;
					production_deduction_id: string | null;
					is_production_deduction: boolean;
					production_deduction_status: string | null;
					// PR 7: production-order deep-link target. NULL for
					// non-production movements, for legacy deduction
					// batches, and after a production order is deleted
					// (ON DELETE SET NULL propagates).
					production_order_id: string | null;
				}[];
			};
			get_quote_production_deduction_preview: {
				Args: { p_quote_id: string };
				Returns: {
					line_number: number;
					material_id: string | null;
					material_name: string;
					material_unit: string;
					material_category: string;
					deduction_quantity: number | null;
					current_stock: number | null;
					projected_stock: number | null;
					shortage_amount: number | null;
					is_complete: boolean;
					warning_code: string | null;
					existing_batch_id: string | null;
					existing_batch_status: string | null;
				}[];
			};
			start_quote_production: {
				Args: {
					p_quote_id: string;
					p_confirm_deduction: boolean;
					p_request_id?: string;
				};
				Returns: Json;
			};
			reverse_production_stock_deduction: {
				Args: {
					p_deduction_id: string;
					p_reversal_reason: string;
					p_reversal_request_id?: string | null;
				};
				Returns: string;
			};
			reverse_stock_movement: {
				Args: {
					p_movement_id: string;
					p_reversal_reason: string;
					p_reversal_request_id?: string | null;
				};
				Returns: string;
			};
			// PR 2: write RPC that creates a production_orders row in
			// state='planned' and appends a creation event. SECURITY DEFINER,
			// role-gated (admin/operational), and uses
			// SET LOCAL app.production_order_write_context = 'rpc' to bridge
			// the PR-1 defense-in-depth triggers. Idempotent on p_request_id.
			//
			// PR 4: the 8th argument p_create_deduction (boolean, default true)
			// controls whether the RPC also creates a deduction batch with
			// production_order_id = NEW.id. The new flow defaults to true
			// (writes non-null FK); PR 2 isolation tests pass false.
			//
			// Returns a single production_orders row (typed below).
			start_production_order: {
				Args: {
					p_quote_id: string;
					p_production_number: string;
					p_planned_start_date?: string | null;
					p_planned_end_date?: string | null;
					p_assigned_to?: string | null;
					p_notes?: string | null;
					p_request_id?: string | null;
					p_create_deduction?: boolean;
				};
				Returns: Database["public"]["Tables"]["production_orders"]["Row"];
			};
			// PR 2: write RPC that transitions a production_orders state and
			// appends an audit event. SECURITY DEFINER, role-gated
			// (admin/operational), and uses
			// SET LOCAL app.production_order_write_context = 'rpc' to bridge
			// the PR-1 defense-in-depth triggers. Idempotent on p_request_id.
			// Allowed transitions: planned->in_progress|cancelled,
			// in_progress->paused|quality_check|cancelled,
			// paused->in_progress|cancelled,
			// quality_check->ready|in_progress, ready->delivered|cancelled;
			// delivered and cancelled are terminal.
			//
			// Returns the updated production_orders row.
			transition_production_order_state: {
				Args: {
					p_order_id: string;
					p_to_state: Database["public"]["Enums"]["production_order_state"];
					p_reason?: string | null;
					p_request_id?: string | null;
				};
				Returns: Database["public"]["Tables"]["production_orders"]["Row"];
			};
			// PR 3: list production orders for the caller's workshop. Returns
			// 16 columns (the 13 production_orders columns + quote_number,
			// quote_furniture_name, assigned_to_name). SECURITY INVOKER: the
			// caller's RLS context applies (workshop_id =
			// get_current_workshop_id()). Filters by state array, assigned_to,
			// quote_id, and ILIKE search on production_number + notes. Default
			// ordering: planned_start_date ASC NULLS LAST, created_at DESC.
			list_production_orders: {
				Args: {
					p_states?:
						| Database["public"]["Enums"]["production_order_state"][]
						| null;
					p_assigned_to?: string | null;
					p_quote_id?: string | null;
					p_search?: string | null;
					p_limit?: number | null;
					p_offset?: number | null;
				};
				Returns: {
					id: string;
					workshop_id: string;
					quote_id: string;
					production_number: string;
					state: Database["public"]["Enums"]["production_order_state"];
					planned_start_date: string | null;
					planned_end_date: string | null;
					actual_start_date: string | null;
					actual_end_date: string | null;
					assigned_to: string | null;
					notes: string | null;
					created_at: string;
					updated_at: string;
					quote_number: string;
					quote_furniture_name: string;
					assigned_to_name: string;
				}[];
			};
			// PR 3: fetch a single production order by id. Returns 19 columns
			// (the 16 from list_production_orders + quote_status,
			// quote_client_id, quote_client_name). SECURITY INVOKER: RLS
			// scopes by workshop — cross-workshop ids return 0 rows, not an
			// error.
			get_production_order: {
				Args: { p_order_id: string };
				Returns: {
					id: string;
					workshop_id: string;
					quote_id: string;
					production_number: string;
					state: Database["public"]["Enums"]["production_order_state"];
					planned_start_date: string | null;
					planned_end_date: string | null;
					actual_start_date: string | null;
					actual_end_date: string | null;
					assigned_to: string | null;
					notes: string | null;
					created_at: string;
					updated_at: string;
					quote_number: string;
					quote_furniture_name: string;
					quote_status: Database["public"]["Enums"]["quote_status"];
					quote_client_id: string | null;
					quote_client_name: string;
					assigned_to_name: string;
				}[];
			};
			// PR 3: append-only audit timeline for a production order.
			// PR 7.2 review-blocker fix: returns 12 columns (the 11
			// production_order_events columns — id, workshop_id,
			// production_order_id, event_type, from_state, to_state,
			// reason, note, actor_id, metadata, created_at — plus
			// actor_name). event_type and note were added in PR 7.
			// PR 3 blocker-fix deterministic ordering: ordered by
			// created_at ASC, id ASC (the id tie-breaker keeps the
			// sequence stable when two events share a created_at,
			// which happens in the same-transaction transition+event
			// write). SECURITY INVOKER: cross-workshop ids return 0
			// rows.
			get_production_order_events: {
				Args: { p_order_id: string };
				Returns: {
					id: string;
					workshop_id: string;
					production_order_id: string;
					// PR 7: the canonical UI label, one of created /
					// transitioned / paused / resumed / cancelled /
					// delivered. Set by the write RPCs (or auto-derived
					// from (from_state, to_state) by the BEFORE INSERT
					// trigger). The EventTimeline UI uses this column
					// as the primary source of the per-row label, with
					// the (from_state, to_state) pair kept as a
					// defense-in-depth fallback.
					event_type: string;
					from_state:
						| Database["public"]["Enums"]["production_order_state"]
						| null;
					to_state: Database["public"]["Enums"]["production_order_state"];
					// Legacy column: kept for back-compat. New code paths
					// should read `note` (which carries the same value).
					reason: string | null;
					// PR 7: the human note attached to the event. The
					// EventTimeline UI renders this verbatim below the
					// transition line.
					note: string | null;
					actor_id: string | null;
					metadata: Json | null;
					created_at: string;
					actor_name: string;
				}[];
			};
			// PR 3: project the effective production status onto every quote
			// in the caller's workshop. Returns 10 columns including
			// production_status (the projected status), stored_status, and
			// has_active_production. SECURITY INVOKER: RLS on both quotes and
			// production_orders scopes by workshop. Projection rules: any
			// active order -> en_produccion; all-delivered (and at least one
			// order exists) -> entregado; otherwise stored_status.
			get_quotes_with_production_status: {
				Args: { p_limit?: number | null; p_offset?: number | null };
				Returns: {
					id: string;
					workshop_id: string;
					quote_number: string;
					furniture_name: string;
					client_id: string | null;
					client_name: string;
					stored_status: Database["public"]["Enums"]["quote_status"];
					production_status: Database["public"]["Enums"]["quote_status"];
					has_active_production: boolean;
					last_event_at: string | null;
				}[];
			};
			// PR 3 + PR 8 review-blocker fix #2: count of
			// production_orders grouped by ACTIVE state for the
			// caller's workshop. Returns exactly 5 rows (one per
			// active state: planned, in_progress, paused,
			// quality_check, ready) in workflow order, with zero
			// counts included for active states with no orders.
			// Terminal states (delivered, cancelled) are EXCLUDED
			// from the pipeline per the production-orders spec
			// "Production Pipeline Stats RPC" requirement. The
			// result set is a 1:1 positional match for the
			// PRODUCTION_ORDER_ACTIVE_STATES array exported from
			// the production feature barrel. SECURITY INVOKER: RLS
			// scopes by workshop.
			get_production_pipeline_stats: {
				Args: Record<PropertyKey, never>;
				Returns: {
					state: Database["public"]["Enums"]["production_order_state"];
					count: number;
				}[];
			};
		};
		Enums: {
			material_category:
				| "madera"
				| "herraje"
				| "pintura"
				| "adhesivo"
				| "vidrio"
				| "tela"
				| "otro";
			unit_of_measure:
				| "ml"
				| "l"
				| "g"
				| "kg"
				| "cm"
				| "m"
				| "cm2"
				| "m2"
				| "cm3"
				| "m3"
				| "un";
			client_source:
				| "mercadolibre"
				| "tiendanube"
				| "instagram"
				| "facebook"
				| "otro";
			quote_status:
				| "presupuesto"
				| "enviado"
				| "aprobado"
				| "en_produccion"
				| "entregado"
				| "cancelado";
			margin_mode: "on_cost" | "on_price";
			wood_subtype: "placa" | "liston" | "tirante" | "columna";
			stock_movement_reason:
				| "compra"
				| "consumo"
				| "merma"
				| "ajuste"
				| "descuento_presupuesto"
				| "reversion"
				| "consumo_produccion";
			// PR 1: production_order_state enum. State machine transitions are
			// validated at the SQL layer by transition_production_order_state.
			// allowed: planned -> in_progress | cancelled;
			//          in_progress -> paused | quality_check | cancelled;
			//          paused -> in_progress | cancelled;
			//          quality_check -> ready | in_progress;
			//          ready -> delivered | cancelled;
			//          delivered and cancelled are terminal.
			production_order_state:
				| "planned"
				| "in_progress"
				| "paused"
				| "quality_check"
				| "ready"
				| "delivered"
				| "cancelled";
			workshop_user_role: "admin" | "operational" | "viewer";
			task_priority: "alta" | "normal" | "baja";
			task_status: "pendiente" | "hecha";
			task_category: "compras" | "produccion" | "administrativo" | "otros";
		};
	};
};
