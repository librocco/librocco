import { init, handleErrorWithSentry } from "@sentry/sveltekit";
import { PUBLIC_SENTRY_DSN } from "$env/static/public";

if (PUBLIC_SENTRY_DSN) {
	init({
		dsn: PUBLIC_SENTRY_DSN,
		tracesSampleRate: 0.1
	});
}

export const handleError = handleErrorWithSentry();
