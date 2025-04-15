import * as Sentry from "@sentry/sveltekit";
import { handleErrorWithSentry } from "@sentry/sveltekit";

import { env } from "$env/dynamic/public";

const SENTRY_DSN = env.PUBLIC_SENTRY_DSN || "";

if (SENTRY_DSN) {
	Sentry.init({
		dsn: SENTRY_DSN,
		// We recommend adjusting this value in production, or using tracesSample for finer control
		tracesSampleRate: 0.1
	});
}

// Sample customized error handler. See https://www.npmjs.com/package/@sentry/sveltekit
// const myErrorHandler = ({ error, event }) => {
// 	console.error("An error occurred on the client side:", error, event);
// };
// export const handleError = handleErrorWithSentry(myErrorHandler);

export const handleError = handleErrorWithSentry();
