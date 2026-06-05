import { useEffect } from "react";
import { useRouteError } from "react-router-dom";
import { captureException } from "@/shared/lib/errorReporter";
import { ErrorBoundaryFallback } from "./ErrorBoundary";

export function RouteErrorFallback() {
	const error = useRouteError();

	useEffect(() => {
		captureException(error, {
			source: "react-router.error-element",
		});
	}, [error]);

	return (
		<ErrorBoundaryFallback
			onRetry={() => {
				if (typeof window !== "undefined") {
					window.location.reload();
				}
			}}
		/>
	);
}
