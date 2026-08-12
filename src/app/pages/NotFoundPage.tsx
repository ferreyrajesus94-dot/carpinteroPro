import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";

/**
 * 404 catch-all page rendered for any URL that does not match a named route.
 * Lives outside the AuthSessionLayout so it works for unauthenticated users
 * too (e.g. bookmark from before logout).
 *
 * Sawdust design tokens only — no raw palette, no inline oklch(), no
 * framework debug copy. The page also sets `document.title` to a
 * deterministic string so assistive tech and external tooling can detect
 * the 404 state.
 */
export function NotFoundPage() {
	useEffect(() => {
		document.title = "404 — Página no encontrada";
	}, []);

	return (
		<div className="flex min-h-screen items-center justify-center bg-cp-bg2 p-4">
		<Card className="max-w-md w-full">
			<CardHeader>
				<p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
					Error 404
				</p>
				<h1 className="mt-2 text-2xl font-semibold leading-none tracking-tight">
					Página no encontrada
				</h1>
			</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						La ruta que buscás no existe o fue movida. Si llegaste acá
						desde un enlace, avisanos y lo revisamos.
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<Button asChild>
							<Link to="/dashboard">Volver al inicio</Link>
						</Button>
						<Button asChild variant="outline">
							<Link to="/">Ir a la landing</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
