import { Component, type ReactNode } from "react";
import { captureException } from "@/shared/lib/errorReporter";
import { ErrorState } from "@/shared/ui/feedback-state";
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
		<div className="flex min-h-screen flex-col items-center justify-center p-8">
			<ErrorState
				title="Algo salió mal"
				description="Podés reintentar la acción. Si el problema continúa, contactá a soporte."
				action={
					<div className="flex flex-col justify-center gap-3 sm:flex-row">
						<button
							className="inline-flex h-10 items-center justify-center rounded-md bg-cp-accent px-4 text-sm font-medium text-[var(--cp-accent-ink)] hover:opacity-90"
							onClick={onRetry}
							type="button"
						>
							Reintentar
						</button>
						{supportHref ? (
							<a
								className="inline-flex h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-medium text-ink2 hover:bg-cp-bg2"
								href={supportHref}
							>
								Contactar soporte
							</a>
						) : null}
					</div>
				}
			/>
		</div>
	);
}

function resolveSupportEmail(supportEmail: string | null | undefined) {
	if (supportEmail === null) return null;
	if (supportEmail === undefined) return getSupportEmail();
	return getSupportEmail(supportEmail);
}
