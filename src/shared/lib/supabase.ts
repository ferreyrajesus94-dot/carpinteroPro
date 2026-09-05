import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/types/database";

const supabaseUrl = import.meta.env.VITE_DB_URL;
const supabaseAnonKey = import.meta.env.VITE_DB_ANON_KEY;
const useMocks =
	import.meta.env.DEV && import.meta.env.VITE_USE_LOCAL_MOCKS === "true";

let supabaseInstance: ReturnType<typeof createClient<Database>>;

if (useMocks) {
	const { mockSupabase } = await import("./mockSupabase");
	supabaseInstance = mockSupabase as unknown as ReturnType<
		typeof createClient<Database>
	>;
} else {
	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error("Missing Supabase environment variables");
	}
	supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseInstance;
