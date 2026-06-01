import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
	purgeLegacyCachePrivacyState,
	purgeSensitiveBrowserState,
} from "@/shared/lib/cachePrivacy";
import { supabase } from "@/shared/lib/supabase";

export type AuthStatus =
	| "initializing"
	| "unauthenticated"
	| "profile_loading"
	| "ready"
	| "profile_missing"
	| "profile_error";

export type ProfileIssueKind = "missing_profile" | "query_error";

export interface ProfileIssue {
	kind: ProfileIssueKind;
	title: string;
	message: string;
	retryable: boolean;
}

interface ProfileRow {
	workshop_id: string | null;
	onboarded_at: string | null;
}

interface AuthContextValue {
	session: Session | null;
	workshopId: string | null;
	onboardedAt: string | null;
	/** true mientras se restaura la sesión inicial o se carga el perfil */
	loading: boolean;
	status: AuthStatus;
	profileIssue: ProfileIssue | null;
	signOut: () => Promise<void>;
	refreshProfile: () => Promise<void>;
}

const missingProfileIssue: ProfileIssue = {
	kind: "missing_profile",
	title: "No pudimos encontrar tu perfil de taller",
	message:
		"Tu sesión está activa, pero no encontramos el perfil asociado a tu cuenta. Reintentá o cerrá sesión. Si continúa, contactá a soporte con el email de tu cuenta.",
	retryable: true,
};

const queryProfileIssue: ProfileIssue = {
	kind: "query_error",
	title: "No pudimos cargar tu perfil de taller",
	message:
		"Hubo un problema al cargar la información de tu taller. Reintentá en unos segundos o cerrá sesión para volver a ingresar.",
	retryable: true,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [session, setSession] = useState<Session | null>(null);
	const [workshopId, setWorkshopIdState] = useState<string | null>(null);
	const [onboardedAt, setOnboardedAt] = useState<string | null>(null);
	const [status, setStatus] = useState<AuthStatus>("initializing");
	const [profileIssue, setProfileIssue] = useState<ProfileIssue | null>(null);
	const loadRequestIdRef = useRef(0);
	const activeUserIdRef = useRef<string | null>(null);
	const sessionRef = useRef<Session | null>(null);

	const isCurrentProfileLoad = useCallback(
		(requestId: number, userId: string) => {
			return (
				requestId === loadRequestIdRef.current &&
				activeUserIdRef.current === userId
			);
		},
		[],
	);

	const clearProfileState = useCallback(() => {
		setWorkshopIdState(null);
		setOnboardedAt(null);
		setProfileIssue(null);
	}, []);

	const applyUnauthenticated = useCallback(() => {
		loadRequestIdRef.current += 1;
		activeUserIdRef.current = null;
		sessionRef.current = null;
		setSession(null);
		clearProfileState();
		setStatus("unauthenticated");
	}, [clearProfileState]);

	const loadProfileForSession = useCallback(
		async (nextSession: Session) => {
			const requestId = loadRequestIdRef.current + 1;
			const userId = nextSession.user.id;
			loadRequestIdRef.current = requestId;
			activeUserIdRef.current = userId;
			sessionRef.current = nextSession;
			setSession(nextSession);
			setStatus("profile_loading");
			setProfileIssue(null);

			async function fetchProfile() {
				return supabase
					.from("profiles")
					.select("workshop_id, onboarded_at")
					.eq("id", userId)
					.maybeSingle<ProfileRow>();
			}

			let { data, error } = await fetchProfile();
			if (!isCurrentProfileLoad(requestId, userId)) return;

			if (error) {
				const retryResult = await fetchProfile();
				if (!isCurrentProfileLoad(requestId, userId)) return;
				data = retryResult.data;
				error = retryResult.error;
			}

			if (error) {
				setWorkshopIdState(null);
				setOnboardedAt(null);
				setProfileIssue(queryProfileIssue);
				setStatus("profile_error");
				return;
			}

			if (!data) {
				setWorkshopIdState(null);
				setOnboardedAt(null);
				setProfileIssue(missingProfileIssue);
				setStatus("profile_missing");
				return;
			}

			setWorkshopIdState(data.workshop_id ?? null);
			setOnboardedAt(data.onboarded_at ?? null);
			setProfileIssue(null);
			setStatus("ready");
		},
		[isCurrentProfileLoad],
	);

	const refreshProfile = useCallback(async () => {
		const currentSession = sessionRef.current;
		if (currentSession?.user?.id) {
			await loadProfileForSession(currentSession);
		}
	}, [loadProfileForSession]);

	const applyAuthenticatedSession = useCallback(
		async (nextSession: Session) => {
			const currentUserId = sessionRef.current?.user.id ?? null;
			const nextUserId = nextSession.user.id;
			if (currentUserId && currentUserId !== nextUserId) {
				loadRequestIdRef.current += 1;
				activeUserIdRef.current = nextUserId;
				sessionRef.current = nextSession;
				setSession(nextSession);
				clearProfileState();
				setStatus("profile_loading");
				await purgeSensitiveBrowserState("user-switch");
			}
			await loadProfileForSession(nextSession);
		},
		[clearProfileState, loadProfileForSession],
	);

	const applyUnauthenticatedWithPurge = useCallback(async () => {
		await purgeSensitiveBrowserState("session-removed");
		applyUnauthenticated();
	}, [applyUnauthenticated]);

	useEffect(() => {
		let cancelled = false;

		async function initializeAuthState() {
			await purgeLegacyCachePrivacyState();
			if (cancelled) return;
			const {
				data: { session: nextSession },
			} = await supabase.auth.getSession();
			if (cancelled) return;
			if (nextSession) {
				await applyAuthenticatedSession(nextSession);
				return;
			}
			await applyUnauthenticatedWithPurge();
		}

		void initializeAuthState();

		// Suscribirse a cambios de sesión (login / logout / refresh)
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, nextSession) => {
			if (nextSession) {
				void applyAuthenticatedSession(nextSession);
				return;
			}
			void applyUnauthenticatedWithPurge();
		});

		return () => {
			cancelled = true;
			subscription.unsubscribe();
		};
	}, [applyAuthenticatedSession, applyUnauthenticatedWithPurge]);

	async function signOut() {
		try {
			await supabase.auth.signOut();
		} finally {
			await purgeSensitiveBrowserState("logout");
		}
	}

	const loading = status === "initializing" || status === "profile_loading";

	return (
		<AuthContext.Provider
			value={{
				session,
				workshopId,
				onboardedAt,
				loading,
				status,
				profileIssue,
				signOut,
				refreshProfile,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

// eslint-disable-next-line react-refresh/only-export-components -- shared hook kept with provider to avoid a broad import migration in this lint cleanup.
export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
	return ctx;
}
