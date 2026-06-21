import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const localMocksBaseURL =
	process.env.E2E_LOCAL_MOCKS_BASE_URL ?? "http://localhost:5174";
const localMocksPort = new URL(localMocksBaseURL).port || "5174";
const adminSnapshotsBaseURL =
	process.env.E2E_ADMIN_SNAPSHOTS_BASE_URL ?? "http://localhost:5175";
const adminSnapshotsPort = new URL(adminSnapshotsBaseURL).port || "5175";

export default defineConfig({
	testDir: "tests/e2e",
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	use: {
		baseURL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			testIgnore: /visual-polish-(a11y|contrast|snapshots(-admin)?)\.spec\.ts/,
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "chromium-local-mocks",
			testMatch: /visual-polish-(a11y|contrast|snapshots)\.spec\.ts/,
			use: {
				...devices["Desktop Chrome"],
				baseURL: localMocksBaseURL,
			},
		},
		{
			name: "chromium-admin-snapshots",
			testMatch: /visual-polish-snapshots-admin\.spec\.ts/,
			use: {
				...devices["Desktop Chrome"],
				baseURL: adminSnapshotsBaseURL,
			},
		},
	],
	webServer: [
		{
			command: "npm run dev -- --host 127.0.0.1",
			url: baseURL,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
		},
		{
			command: `npm run dev -- --host 127.0.0.1 --port ${localMocksPort} --strictPort`,
			url: localMocksBaseURL,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
			env: {
				VITE_USE_LOCAL_MOCKS: "true",
			},
		},
		{
			command: `npm run dev -- --host 127.0.0.1 --port ${adminSnapshotsPort} --strictPort`,
			url: adminSnapshotsBaseURL,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
			env: {
				VITE_USE_LOCAL_MOCKS: "true",
				VITE_MOCK_ADMIN: "true",
			},
		},
	],
});
