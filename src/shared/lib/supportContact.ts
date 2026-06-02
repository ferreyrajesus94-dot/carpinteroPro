export interface SupportMailtoOptions {
	email?: string | null;
	subject?: string;
	body?: string;
}

export function getSupportEmail(
	email: string | undefined = import.meta.env.VITE_SUPPORT_EMAIL,
) {
	const trimmed = email?.trim();
	if (!trimmed || !isValidSupportEmail(trimmed)) return null;
	return trimmed;
}

export function getSupportMailtoHref(options: SupportMailtoOptions = {}) {
	const email = options.email === null ? null : getSupportEmail(options.email);
	if (!email) return null;

	const params = [
		formatMailtoParam("subject", options.subject),
		formatMailtoParam("body", options.body),
	].filter((param): param is string => param !== null);

	const query = params.join("&");
	return query ? `mailto:${email}?${query}` : `mailto:${email}`;
}

function formatMailtoParam(key: string, value: string | undefined) {
	if (!value) return null;
	return `${key}=${encodeURIComponent(value)}`;
}

function isValidSupportEmail(email: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
