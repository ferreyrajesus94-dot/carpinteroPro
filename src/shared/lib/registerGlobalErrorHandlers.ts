import { captureException } from "./errorReporter";

export function registerGlobalErrorHandlers(target: Window = window) {
	const handleError = (event: ErrorEvent) => {
		captureException(event.error ?? event.message, {
			source: "window.error",
			route: target.location.pathname,
		});
	};

	const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
		captureException(event.reason, {
			source: "window.unhandledrejection",
			route: target.location.pathname,
		});
	};

	target.addEventListener("error", handleError);
	target.addEventListener("unhandledrejection", handleUnhandledRejection);

	return () => {
		target.removeEventListener("error", handleError);
		target.removeEventListener("unhandledrejection", handleUnhandledRejection);
	};
}
