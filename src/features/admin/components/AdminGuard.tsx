import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/shared/providers/AuthProvider";

interface AdminGuardProps {
	children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
	const auth = useAuth();

	if (
		auth.loading ||
		auth.status === "initializing" ||
		auth.status === "profile_loading"
	) {
		return (
			<div
				className="flex min-h-screen items-center justify-center bg-background"
				role="status"
				aria-label="Cargando acceso de administrador"
			>
				<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
			</div>
		);
	}

	if (auth.status === "unauthenticated" || !auth.session) {
		return <Navigate to="/login" replace />;
	}

	if (!auth.isPlatformAdmin) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
				<section className="w-full max-w-md rounded-xl border border-line bg-cp-surface p-6 text-center shadow-sm">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
						<i
							className="fi fi-rr-lock text-xl leading-none"
							aria-hidden="true"
						/>
					</div>
					<h1 className="font-display text-xl font-semibold tracking-tight text-ink">
						Acceso de administrador requerido
					</h1>
					<p className="mt-3 text-sm leading-6 text-ink2">
						Tu cuenta no tiene permisos para administrar la plataforma.
					</p>
				</section>
			</main>
		);
	}

	return children;
}
