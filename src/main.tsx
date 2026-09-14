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
	// configure a DSN. The await is fire-and-forget: `initErrorReporter`
	// above already gated the no-op path on the same DSN, so swapping
	// the client does not change the captured/reported behavior.
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
