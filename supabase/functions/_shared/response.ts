function corsHeaders() {
	return {
		"Access-Control-Allow-Origin":
			Deno.env.get("APP_ORIGIN") || "http://localhost:3000",
		"Access-Control-Allow-Headers":
			"authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
		"Access-Control-Allow-Methods": "POST, OPTIONS",
	};
}

export function preflight(req: Request) {
	return req.method === "OPTIONS"
		? new Response("ok", { headers: corsHeaders() })
		: null;
}

export function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...corsHeaders(), "Content-Type": "application/json" },
	});
}

export function err(message: string, status = 500) {
	return json({ error: message }, status);
}
