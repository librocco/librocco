import "../src/lib/main.css";

import { setLocale } from "@librocco/shared/i18n-svelte";
import { loadLocaleAsync } from "@librocco/shared/i18n-util.async";
import { DEFAULT_LOCALE } from "$lib/constants";

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
