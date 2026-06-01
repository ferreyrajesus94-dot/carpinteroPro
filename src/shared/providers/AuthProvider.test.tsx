import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

// ── Mock supabase before any imports that depend on it ──────────────────────
vi.mock("@/shared/lib/supabase", () => ({
	supabase: {
		auth: {
			getSession: vi.fn(),
			onAuthStateChange: vi.fn(),
			signOut: vi.fn(),
		},
		from: vi.fn(),
	},
}));

vi.mock("@/shared/lib/cachePrivacy", () => ({
	purgeLegacyCachePrivacyState: vi.fn().mockResolvedValue(undefined),
	purgeSensitiveBrowserState: vi.fn().mockResolvedValue(undefined),
}));

import * as supabaseLib from "@/shared/lib/supabase";
import * as cachePrivacy from "@/shared/lib/cachePrivacy";
import { AuthProvider, useAuth } from "./AuthProvider";

// Typed aliases for convenience
const mockAuth = supabaseLib.supabase.auth as unknown as {
	getSession: ReturnType<typeof vi.fn>;
	onAuthStateChange: ReturnType<typeof vi.fn>;
	signOut: ReturnType<typeof vi.fn>;
};
const mockFrom = supabaseLib.supabase.from as unknown as ReturnType<
	typeof vi.fn
>;

const mockPurgeLegacyCachePrivacyState =
	cachePrivacy.purgeLegacyCachePrivacyState as unknown as ReturnType<
		typeof vi.fn
	>;
const mockPurgeSensitiveBrowserState =
	cachePrivacy.purgeSensitiveBrowserState as unknown as ReturnType<
		typeof vi.fn
	>;

const WORKSHOP_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "user-abc-123";
const ONBOARDED_AT = "2026-05-31T12:00:00.000Z";

type ProfileRow = {
	workshop_id: string | null;
	onboarded_at: string | null;
};

type ProfileQueryError = {
	message: string;
};

type ProfileQueryResult = {
	data: ProfileRow | null;
	error: ProfileQueryError | null;
};

let profileLookupCalls = 0;

function makeProfileRow(
	workshopId: string | null = WORKSHOP_ID,
	onboardedAt: string | null = ONBOARDED_AT,
): ProfileRow {
	return { workshop_id: workshopId, onboarded_at: onboardedAt };
}

function profileSuccess(row = makeProfileRow()): ProfileQueryResult {
	return { data: row, error: null };
}

function profileMissing(): ProfileQueryResult {
	return { data: null, error: null };
}

function profileError(message = "RLS denied"): ProfileQueryResult {
	return { data: null, error: { message } };
}

/** Build the chainable `.from('profiles').select(...).eq(...).maybeSingle()` mock. */
function mockProfileQuery(workshopId: string | null) {
	mockProfileQueryResults([
		workshopId ? profileSuccess(makeProfileRow(workshopId)) : profileMissing(),
	]);
}

function mockProfileQueryResults(
	results: Array<ProfileQueryResult | Promise<ProfileQueryResult>>,
) {
	const queue = [...results];
	mockFrom.mockImplementation(() => {
		const resolveNext = vi.fn(() => {
			profileLookupCalls += 1;
			return Promise.resolve(queue.shift() ?? profileMissing());
		});
		const eq = vi.fn().mockReturnValue({
			maybeSingle: resolveNext,
			single: resolveNext,
		});
		const select = vi.fn().mockReturnValue({ eq });
		return { select };
	});
}

function createDeferredProfileResult() {
	let resolve!: (value: ProfileQueryResult) => void;
	const promise = new Promise<ProfileQueryResult>((resolver) => {
		resolve = resolver;
	});
	return { promise, resolve };
}

function createDeferredVoid() {
	let resolve!: () => void;
	const promise = new Promise<void>((resolver) => {
		resolve = resolver;
	});
	return { promise, resolve };
}

/** Returns a subscription stub; also exposes the last registered callback. */
function makeSubscription() {
	const unsubscribe = vi.fn();
	let cb: (event: string, session: unknown) => void = () => {};
	mockAuth.onAuthStateChange.mockImplementation((handler: typeof cb) => {
		cb = handler;
		return { data: { subscription: { unsubscribe } } };
	});
	return {
		unsubscribe,
		fire: (event: string, session: unknown) =>
			act(() => {
				cb(event, session);
			}),
	};
}

function makeWrapper() {
	return ({ children }: { children: ReactNode }) =>
		createElement(AuthProvider, null, children);
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe("AuthProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		profileLookupCalls = 0;
		mockPurgeLegacyCachePrivacyState.mockResolvedValue(undefined);
		mockPurgeSensitiveBrowserState.mockResolvedValue(undefined);
		// Default subscription stub (overridden per-test when needed)
		mockAuth.onAuthStateChange.mockReturnValue({
			data: { subscription: { unsubscribe: vi.fn() } },
		});
	});

	it("starts with loading=true, then resolves to false when no session", async () => {
		mockAuth.getSession.mockResolvedValue({ data: { session: null } });

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

		expect(result.current.loading).toBe(true);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.session).toBeNull();
		expect(result.current.workshopId).toBeNull();
	});

	it("exposes explicit status and profileIssue while preserving compatibility fields", async () => {
		mockAuth.getSession.mockResolvedValue({ data: { session: null } });

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

		expect(result.current.status).toBe("initializing");
		expect(result.current.profileIssue).toBeNull();
		expect(result.current.loading).toBe(true);
		expect(result.current.signOut).toEqual(expect.any(Function));
		expect(result.current.refreshProfile).toEqual(expect.any(Function));

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.status).toBe("unauthenticated");
		expect(result.current.session).toBeNull();
		expect(result.current.workshopId).toBeNull();
		expect(result.current.onboardedAt).toBeNull();
		expect(result.current.profileIssue).toBeNull();
	});

	it("loads workshopId from profile when a session is restored", async () => {
		const session = { user: { id: USER_ID } };
		mockAuth.getSession.mockResolvedValue({ data: { session } });
		mockProfileQuery(WORKSHOP_ID);

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.session).toBe(session);
		expect(result.current.status).toBe("ready");
		expect(result.current.profileIssue).toBeNull();
		expect(result.current.workshopId).toBe(WORKSHOP_ID);
	});

	it("keeps a valid not-onboarded profile in ready state", async () => {
		const session = { user: { id: USER_ID } };
		mockAuth.getSession.mockResolvedValue({ data: { session } });
		mockProfileQueryResults([
			profileSuccess(makeProfileRow(WORKSHOP_ID, null)),
		]);

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.status).toBe("ready");
		expect(result.current.workshopId).toBe(WORKSHOP_ID);
		expect(result.current.onboardedAt).toBeNull();
		expect(result.current.profileIssue).toBeNull();
	});

	it("sets profile_missing when the restored session has no profile row", async () => {
		const session = { user: { id: USER_ID } };
		mockAuth.getSession.mockResolvedValue({ data: { session } });
		mockProfileQueryResults([profileMissing()]);

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

		await waitFor(() => expect(result.current.status).toBe("profile_missing"));

		expect(result.current.loading).toBe(false);
		expect(result.current.workshopId).toBeNull();
		expect(result.current.onboardedAt).toBeNull();
		expect(result.current.profileIssue).toMatchObject({
			kind: "missing_profile",
			retryable: true,
		});
		expect(profileLookupCalls).toBe(1);
	});

	it("retries one query error once, then sets profile_error", async () => {
		const session = { user: { id: USER_ID } };
		mockAuth.getSession.mockResolvedValue({ data: { session } });
		mockProfileQueryResults([profileError(), profileError("still down")]);

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

		await waitFor(() => expect(result.current.status).toBe("profile_error"));

		expect(profileLookupCalls).toBe(2);
		expect(result.current.loading).toBe(false);
		expect(result.current.workshopId).toBeNull();
		expect(result.current.onboardedAt).toBeNull();
		expect(result.current.profileIssue).toMatchObject({
			kind: "query_error",
			retryable: true,
		});
	});

	it("recovers to ready when the automatic retry succeeds", async () => {
		const session = { user: { id: USER_ID } };
		mockAuth.getSession.mockResolvedValue({ data: { session } });
		mockProfileQueryResults([profileError(), profileSuccess()]);

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

		await waitFor(() => expect(result.current.status).toBe("ready"));

		expect(profileLookupCalls).toBe(2);
		expect(result.current.workshopId).toBe(WORKSHOP_ID);
		expect(result.current.onboardedAt).toBe(ONBOARDED_AT);
		expect(result.current.profileIssue).toBeNull();
	});

	it("manual retry recovers from a missing profile state", async () => {
		const session = { user: { id: USER_ID } };
		mockAuth.getSession.mockResolvedValue({ data: { session } });
		mockProfileQueryResults([profileMissing(), profileSuccess()]);

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
		await waitFor(() => expect(result.current.status).toBe("profile_missing"));

		await act(() => result.current.refreshProfile());

		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(result.current.workshopId).toBe(WORKSHOP_ID);
		expect(result.current.profileIssue).toBeNull();
	});

	it("manual retry recovers from a profile error state", async () => {
		const session = { user: { id: USER_ID } };
		mockAuth.getSession.mockResolvedValue({ data: { session } });
		mockProfileQueryResults([
			profileError(),
			profileError("still down"),
			profileSuccess(),
		]);

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
		await waitFor(() => expect(result.current.status).toBe("profile_error"));

		await act(() => result.current.refreshProfile());

		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(result.current.workshopId).toBe(WORKSHOP_ID);
		expect(result.current.profileIssue).toBeNull();
	});

	it("updates session and workshopId when onAuthStateChange fires a login", async () => {
		mockAuth.getSession.mockResolvedValue({ data: { session: null } });
		const sub = makeSubscription();
		mockProfileQuery(WORKSHOP_ID);

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
		await waitFor(() => expect(result.current.loading).toBe(false));

		const newSession = { user: { id: USER_ID } };
		sub.fire("SIGNED_IN", newSession);

		await waitFor(() => expect(result.current.workshopId).toBe(WORKSHOP_ID));
		expect(result.current.session).toBe(newSession);
		expect(result.current.status).toBe("ready");
	});

	it("clears stale workshopId when a later profile lookup has no profile", async () => {
		const firstSession = { user: { id: USER_ID } };
		mockAuth.getSession.mockResolvedValue({ data: { session: firstSession } });
		const sub = makeSubscription();
		mockProfileQueryResults([profileSuccess(), profileMissing()]);

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
		await waitFor(() => expect(result.current.workshopId).toBe(WORKSHOP_ID));

		const nextSession = { user: { id: "user-without-profile" } };
		sub.fire("SIGNED_IN", nextSession);

		await waitFor(() => expect(result.current.status).toBe("profile_missing"));
		expect(result.current.workshopId).toBeNull();
		expect(result.current.session).toBe(nextSession);
	});

	it("does not let stale profile loads overwrite newer sign-out state", async () => {
		const staleProfile = createDeferredProfileResult();
		const session = { user: { id: USER_ID } };
		mockAuth.getSession.mockResolvedValue({ data: { session } });
		const sub = makeSubscription();
		mockProfileQueryResults([staleProfile.promise]);

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
		await waitFor(() => expect(result.current.status).toBe("profile_loading"));

		sub.fire("SIGNED_OUT", null);
		await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

		await act(async () => {
			staleProfile.resolve(profileSuccess());
			await staleProfile.promise;
		});

		expect(result.current.status).toBe("unauthenticated");
		expect(result.current.session).toBeNull();
		expect(result.current.workshopId).toBeNull();
	});

	it("clears session and workshopId on logout via onAuthStateChange", async () => {
		mockAuth.getSession.mockResolvedValue({ data: { session: null } });
		const sub = makeSubscription();

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
		await waitFor(() => expect(result.current.loading).toBe(false));

		sub.fire("SIGNED_OUT", null);

		expect(result.current.status).toBe("unauthenticated");
		expect(result.current.session).toBeNull();
		expect(result.current.workshopId).toBeNull();
		expect(result.current.profileIssue).toBeNull();
	});

	it("runs startup legacy cleanup before restoring an authenticated session", async () => {
		const session = { user: { id: USER_ID } };
		mockAuth.getSession.mockResolvedValue({ data: { session } });
		mockProfileQuery(WORKSHOP_ID);

		renderHook(() => useAuth(), { wrapper: makeWrapper() });

		await waitFor(() =>
			expect(mockPurgeLegacyCachePrivacyState).toHaveBeenCalledOnce(),
		);
		expect(mockAuth.getSession).toHaveBeenCalledOnce();
	});

	it("purges sensitive state when auth transitions to signed out", async () => {
		mockAuth.getSession.mockResolvedValue({ data: { session: null } });
		const sub = makeSubscription();

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
		await waitFor(() => expect(result.current.loading).toBe(false));

		sub.fire("SIGNED_OUT", null);

		await waitFor(() => {
			expect(mockPurgeSensitiveBrowserState).toHaveBeenCalledWith(
				"session-removed",
			);
		});
		expect(result.current.status).toBe("unauthenticated");
	});

	it("purges user data before loading a different authenticated user", async () => {
		const firstSession = { user: { id: USER_ID } };
		mockAuth.getSession.mockResolvedValue({ data: { session: firstSession } });
		const sub = makeSubscription();
		mockProfileQueryResults([
			profileSuccess(),
			profileSuccess(),
			profileSuccess(makeProfileRow("workshop-b")),
		]);

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
		await waitFor(() => expect(result.current.status).toBe("ready"));

		sub.fire("TOKEN_REFRESHED", { user: { id: USER_ID } });
		await waitFor(() => expect(result.current.session?.user.id).toBe(USER_ID));
		expect(mockPurgeSensitiveBrowserState).not.toHaveBeenCalledWith(
			"user-switch",
		);

		const switchPurge = createDeferredVoid();
		mockPurgeSensitiveBrowserState.mockImplementationOnce(
			() => switchPurge.promise,
		);
		sub.fire("SIGNED_IN", { user: { id: "user-b" } });

		await waitFor(() => {
			expect(mockPurgeSensitiveBrowserState).toHaveBeenCalledWith(
				"user-switch",
			);
			expect(result.current.status).toBe("profile_loading");
			expect(result.current.loading).toBe(true);
			expect(result.current.workshopId).toBeNull();
			expect(result.current.session?.user.id).toBe("user-b");
		});

		switchPurge.resolve();
		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(result.current.workshopId).toBe("workshop-b");
	});

	it("signOut calls supabase.auth.signOut before logout purge", async () => {
		mockAuth.getSession.mockResolvedValue({ data: { session: null } });
		mockAuth.signOut.mockResolvedValue({});

		const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(() => result.current.signOut());

		expect(mockAuth.signOut).toHaveBeenCalledOnce();
		expect(mockPurgeSensitiveBrowserState).toHaveBeenCalledWith("logout");

		const logoutCallIndex = mockPurgeSensitiveBrowserState.mock.calls.findIndex(
			([reason]) => reason === "logout",
		);
		expect(logoutCallIndex).toBeGreaterThanOrEqual(0);

		const logoutCallOrder =
			mockPurgeSensitiveBrowserState.mock.invocationCallOrder[logoutCallIndex];
		expect(mockAuth.signOut.mock.invocationCallOrder[0]).toBeLessThan(
			logoutCallOrder,
		);
	});

	it("unsubscribes from auth changes on unmount", async () => {
		mockAuth.getSession.mockResolvedValue({ data: { session: null } });
		const { unsubscribe } = makeSubscription();

		const { unmount } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
		await waitFor(() => {}); // let useEffect settle

		unmount();

		expect(unsubscribe).toHaveBeenCalledOnce();
	});

	it("useAuth throws when used outside AuthProvider", () => {
		expect(() => renderHook(() => useAuth())).toThrow(
			"useAuth must be used inside <AuthProvider>",
		);
	});
});
