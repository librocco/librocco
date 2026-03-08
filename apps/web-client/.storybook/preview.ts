import "../src/lib/main.css";

import { setLocale } from "@librocco/shared/i18n-svelte";
import { loadLocaleAsync } from "@librocco/shared/i18n-util.async";
import { DEFAULT_LOCALE } from "$lib/constants";

const sveltekitDev = ((globalThis as { __sveltekit_dev?: { env?: Record<string, string> } }).__sveltekit_dev ??= {});
sveltekitDev.env ??= {};
sveltekitDev.env.PUBLIC_SENTRY_DSN ??= "";
sveltekitDev.env.PUBLIC_WEBLATE_COMPONENT_URL ??= "";
sveltekitDev.env.PUBLIC_WEBLATE_API_KEY ??= "";

// Initialize i18n globally for all stories
// TODO: Consider updating to use decorators or a more sophisticated i18n provider pattern
// to handle locale changes and provide better control over translation loading
let i18nInitialized = false;

export default {
	loaders: [
		async () => {
			if (!i18nInitialized) {
				await loadLocaleAsync(DEFAULT_LOCALE);
				setLocale(DEFAULT_LOCALE);
				i18nInitialized = true;
			}
			return {};
		}
	]
};
