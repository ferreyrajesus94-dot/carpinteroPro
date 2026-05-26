import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthContext {
	userId: string;
	workshopId: string;
	email: string;
}

export class AuthError extends Error {
	status = 401;
}

export function serviceClient() {
	return createClient(
		Deno.env.get("SUPABASE_URL")!,
		Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
		{ auth: { autoRefreshToken: false, persistSession: false } },
	);
}

export async function getAuthContext(req: Request): Promise<AuthContext> {
	const auth = req.headers.get("Authorization");
	if (!auth?.startsWith("Bearer "))
		throw new AuthError("Missing Authorization");

	const supabase = serviceClient();
	const token = auth.slice("Bearer ".length);
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser(token);
	if (error || !user) throw new AuthError("Invalid token");

	const { data: profile, error: profileError } = await supabase
		.from("profiles")
		.select("workshop_id")
		.eq("id", user.id)
		.single();

	if (profileError || !profile?.workshop_id)
		throw new AuthError("Profile not found");
	return {
		userId: user.id,
		workshopId: profile.workshop_id,
		email: user.email ?? "",
	};
}
