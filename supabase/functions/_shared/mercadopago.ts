const BASE = "https://api.mercadopago.com";

function headers() {
	return {
		Authorization: `Bearer ${Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")}`,
		"Content-Type": "application/json",
	};
}

export async function createPreapproval(body: Record<string, unknown>) {
	const res = await fetch(`${BASE}/preapproval`, {
		method: "POST",
		headers: headers(),
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`MP createPreapproval ${res.status}`);
	return res.json();
}

export async function getPreapproval(id: string) {
	const res = await fetch(`${BASE}/preapproval/${id}`, { headers: headers() });
	if (!res.ok) throw new Error(`MP getPreapproval ${res.status}`);
	return res.json();
}


export async function cancelPreapproval(id: string) {
	const res = await fetch(`${BASE}/preapproval/${id}`, {
		method: "PUT",
		headers: headers(),
		body: JSON.stringify({ status: "cancelled" }),
	});
	if (!res.ok) throw new Error(`MP cancelPreapproval ${res.status}`);
	return res.json();
}
