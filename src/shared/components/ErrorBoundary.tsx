import { Component, type ReactNode } from "react";
import { captureException } from "@/shared/lib/errorReporter";
import {
	getSupportEmail,
	getSupportMailtoHref,
} from "@/shared/lib/supportContact";

interface ErrorBoundaryProps {
	children: ReactNode;
	name?: string;
	supportEmail?: string | null;
}

interface ErrorBoundaryState {
	hasError: boolean;
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	state: ErrorBoundaryState = { hasError: false };

	static getDerivedStateFromError(): ErrorBoundaryState {
		return { hasError: true };
	}

	componentDidCatch(error: Error) {
		captureException(error, {
			source: "react-error-boundary",
			boundary: this.props.name,
		});
	}

	render() {
		if (!this.state.hasError) return this.props.children;

		return (
			<ErrorBoundaryFallback
				onRetry={() => this.setState({ hasError: false })}
				supportEmail={this.props.supportEmail}
			/>
		);
	}
}

interface ErrorBoundaryFallbackProps {
	onRetry: () => void;
	supportEmail?: string | null;
}

export function ErrorBoundaryFallback({
	onRetry,
	supportEmail,
}: ErrorBoundaryFallbackProps) {
	const email = resolveSupportEmail(supportEmail);
	const supportHref = getSupportMailtoHref({
		email,
		subject: "Error en CarpinteroPro",
		body: "Necesito ayuda con un error de la aplicación.",
	});

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
			<div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
				<p className="text-lg font-semibold text-red-700">Algo salió mal</p>
				<p className="mt-2 text-sm text-slate-600">
					Podés reintentar la acción. Si el problema continúa, contactá a
					soporte.
				</p>
				<div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
					<button
						className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
						onClick={onRetry}
						type="button"
					>
						Reintentar
					</button>
					{supportHref ? (
						<a
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
							href={supportHref}
						>
							Contactar soporte
						</a>
					) : null}
				</div>
			</div>
		</div>
	);
}

function resolveSupportEmail(supportEmail: string | null | undefined) {
	if (supportEmail === null) return null;
	if (supportEmail === undefined) return getSupportEmail();
	return getSupportEmail(supportEmail);
}
