// @ts-expect-error Deno Edge Functions resolve remote ESM imports at runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
	env: { get(key: string): string | undefined };
};

export interface PlatformAdminContext {
	userId: string;
	email: string;
}

interface ProfileAdminRow {
	is_platform_admin: boolean | null;
}

export class AdminAuthError extends Error {
	constructor(
		message: string,
		readonly status: 401 | 403 = 401,
	) {
		super(message);
	}
}

function bearerToken(req: Request) {
	const auth = req.headers.get("Authorization");
	if (!auth?.startsWith("Bearer ")) {
		throw new AdminAuthError("Missing Authorization", 401);
	}
	return auth.slice("Bearer ".length);
}

function anonClient(req: Request) {
	return createClient(
		Deno.env.get("SUPABASE_URL")!,
		Deno.env.get("SUPABASE_ANON_KEY")!,
		{
			auth: { autoRefreshToken: false, persistSession: false },
			global: {
				headers: { Authorization: req.headers.get("Authorization") ?? "" },
			},
		},
	);
}

export async function requirePlatformAdmin(
	req: Request,
): Promise<PlatformAdminContext> {
	const token = bearerToken(req);
	const supabase = anonClient(req);
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser(token);
	if (error || !user) {
		throw new AdminAuthError("Invalid token", 401);
	}

	const { data: profile, error: profileError } = await supabase
		.from("profiles")
		.select("is_platform_admin")
		.eq("id", user.id)
		.maybeSingle<ProfileAdminRow>();

	if (profileError || !profile?.is_platform_admin) {
		throw new AdminAuthError("Platform admin access required", 403);
	}

	return {
		userId: user.id,
		email: user.email ?? "",
	};
}
