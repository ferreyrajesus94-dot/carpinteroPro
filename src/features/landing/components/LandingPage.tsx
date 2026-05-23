import { Link } from "react-router-dom";

export function LandingPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-6 px-6 py-20 text-center">
				<p className="rounded-full border border-line bg-cp-surface px-3 py-1 text-xs font-medium text-ink2">
					Para carpinteros independientes y talleres
				</p>
				<h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
					CarpinteroPro
				</h1>
				<p className="max-w-2xl text-base leading-7 text-ink2 sm:text-lg">
					Una landing pública para presentar la herramienta sin mezclarla con
					la aplicación privada del taller.
				</p>
				<Link
					to="/login"
					className="inline-flex h-12 items-center justify-center rounded-md bg-cp-accent px-6 text-sm font-semibold text-[var(--cp-accent-ink)] shadow-sm"
				>
					Iniciar sesión
				</Link>
			</main>
		</div>
	);
}
