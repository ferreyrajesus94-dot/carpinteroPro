#!/usr/bin/env node
/**
 * Manual foreground login helper.
 *
 * Reads E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD from .env on disk so the
 * values never appear in chat output or process listings. Opens Chromium
 * in headed mode, performs the login flow against /login, and leaves the
 * browser window open so the user can keep using it.
 *
 * Usage:
 *   node scripts/playwright-login.mjs                 # uses https://carpintero-pro.vercel.app
 *   node scripts/playwright-login.mjs http://localhost:5173
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.resolve(process.cwd(), ".env");
const DEFAULT_BASE_URL = "https://carpintero-pro.vercel.app";

/** Parse a `.env` file into a flat object. Values are returned as-is. */
function readEnvFile(filePath) {
	if (!fs.existsSync(filePath)) {
		throw new Error(`.env not found at ${filePath}`);
	}
	const text = fs.readFileSync(filePath, "utf8");
	const out = {};
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq === -1) continue;
		const key = line.slice(0, eq).trim();
		let value = line.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		out[key] = value;
	}
	return out;
}

function requireEnv(env, key) {
	const value = env[key];
	if (!value) {
		throw new Error(`${key} not set in .env`);
	}
	return value;
}

function maskEmail(email) {
	if (!email || !email.includes("@")) return "<email>";
	const [local, domain] = email.split("@");
	return `${local[0] ?? ""}***@${domain}`;
}

async function main() {
	const baseUrl = process.argv[2] || DEFAULT_BASE_URL;

	console.log(`[login] reading ${ENV_PATH}`);
	const env = readEnvFile(ENV_PATH);
	const email = requireEnv(env, "E2E_ADMIN_EMAIL");
	const password = requireEnv(env, "E2E_ADMIN_PASSWORD");
	console.log(`[login] env loaded (email=${maskEmail(email)}, password=<redacted>)`);

	console.log(`[login] launching headed chromium against ${baseUrl}`);
	const browser = await chromium.launch({
		headless: false,
		args: ["--no-sandbox", "--disable-dev-shm-usage"],
	});
	// R3-BROWSER-LEAK fix: register signal handlers before any work that
	// could throw, so a SIGINT/SIGTERM during the login flow or a thrown
	// error from any of the awaited calls below closes the chromium
	// subprocess instead of orphaning it.
	let browserClosed = false;
	const closeBrowser = async (reason) => {
		if (browserClosed) return;
		browserClosed = true;
		try {
			await browser.close();
			console.log(`[login] browser closed (${reason})`);
		} catch (closeErr) {
			console.error(`[login] failed to close browser: ${closeErr.message}`);
		}
	};
	process.once("SIGINT", () => {
		void closeBrowser("SIGINT").then(() => process.exit(130));
	});
	process.once("SIGTERM", () => {
		void closeBrowser("SIGTERM").then(() => process.exit(143));
	});

	try {
		const context = await browser.newContext({
			viewport: { width: 1366, height: 900 },
		});
		const page = await context.newPage();

		// Surface client-side errors to the terminal but never echo input values.
		page.on("pageerror", (err) => console.error("[page error]", err.message));
		page.on("console", (msg) => {
			if (msg.type() === "error") console.error("[console error]", msg.text());
		});

		console.log(`[login] navigating to ${baseUrl}/login`);
		await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });

		console.log(`[login] filling credentials`);
		await page.waitForSelector('input[type="email"]', { timeout: 15000 });
		await page.fill('input[type="email"]', email);
		await page.fill('input[type="password"]', password);

		console.log(`[login] submitting form`);
		await Promise.all([
			page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 20000 }),
			page.click('button[type="submit"]'),
		]);

		const finalUrl = page.url();
		console.log(`[login] login ok -> ${new URL(finalUrl).pathname}`);
		console.log(`[login] browser left open. Close it manually when you are done.`);

		// Keep the process alive so the browser window stays open.
		await new Promise(() => {});
	} finally {
		// If the login flow throws (selector timeout, navigation timeout,
		// click failure, etc.), make sure the chromium subprocess is closed
		// before the process exits. The signal handlers above cover the
		// SIGINT/SIGTERM path; this finally covers every other throw.
		await closeBrowser("login flow exit");
	}
}

main().catch((err) => {
	console.error("[login] failed:", err.message);
	process.exitCode = 1;
});