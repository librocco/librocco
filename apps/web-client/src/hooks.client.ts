import { init, handleErrorWithSentry } from "@sentry/sveltekit";
import { PUBLIC_SENTRY_DSN } from "$env/static/public";
import { env } from "$env/dynamic/public";

if (PUBLIC_SENTRY_DSN) {
	init({
		dsn: PUBLIC_SENTRY_DSN,
		release: import.meta.env.VITE_GIT_SHA,
		environment: env.PUBLIC_SENTRY_ENVIRONMENT || undefined,
		tracesSampleRate: 0.1
	});
}

export const handleError = handleErrorWithSentry();
