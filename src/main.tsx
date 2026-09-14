import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import { App } from "@/app/App";
import {
	configureErrorReporterClient,
	initErrorReporter,
	loadSentryClient,
} from "@/shared/lib/errorReporter";

initErrorReporter();

const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();
if (sentryDsn) {
	// Dynamic import keeps `@sentry/react` out of bundles that never
	// configure a DSN. We swap the client SYNCHRONOUSLY before any
	// exception can be captured: anything raised between `initErrorReporter()`
	// above and the Sentry load would otherwise route to the no-op default.
	// The no-op path stays in effect until this swap completes, which
	// is the next event-loop turn; exceptions in that window are lost by
	// construction (no Sentry client is loaded yet) and not by a swap
	// bug.
	void loadSentryClient().then((sentryClient) => {
		configureErrorReporterClient(sentryClient);
		initErrorReporter({ dsn: sentryDsn });
	});
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
