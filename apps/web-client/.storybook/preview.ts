import "../src/lib/main.css";

import type { Preview } from "@storybook/svelte";
import { setLocale } from "@librocco/shared/i18n-svelte";
import { loadLocaleAsync } from "@librocco/shared/i18n-util.async";
import { DEFAULT_LOCALE } from "$lib/constants";

// Initialize i18n globally for all stories
// TODO: Consider updating to use decorators or a more sophisticated i18n provider pattern
// to handle locale changes and provide better control over translation loading
let i18nInitialized = false;

function applyStorybookTheme(backgroundValue: unknown) {
	if (typeof document === "undefined") {
		return;
	}

	const isDark = backgroundValue === "dark";
	const theme = isDark ? "sunset" : "lofi";
	const colorScheme = isDark ? "dark" : "light";

	document.documentElement.setAttribute("data-theme", theme);
	document.body.setAttribute("data-theme", theme);
	document.documentElement.style.colorScheme = colorScheme;
	document.body.style.colorScheme = colorScheme;
}

const preview: Preview = {
	decorators: [
		(Story, context) => {
			applyStorybookTheme(context.globals?.backgrounds?.value);
			return Story();
		}
	],
	loaders: [
		async ({ globals }) => {
			if (!i18nInitialized) {
				await loadLocaleAsync(DEFAULT_LOCALE);
				setLocale(DEFAULT_LOCALE);
				i18nInitialized = true;
			}

			applyStorybookTheme(globals?.backgrounds?.value);
			return {};
		}
	]
};

export default preview;
