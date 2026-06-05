import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { queryClient } from "@/shared/lib/queryClient";
import { registerGlobalErrorHandlers } from "@/shared/lib/registerGlobalErrorHandlers";
import { router } from "./router";

export function App() {
	useEffect(() => {
		const cleanup = registerGlobalErrorHandlers();
		return cleanup;
	}, []);

	return (
		<ErrorBoundary name="app-root">
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
				<Toaster position="bottom-right" theme="system" richColors />
			</QueryClientProvider>
		</ErrorBoundary>
	);
}
