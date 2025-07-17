import { loadedLocales } from "@librocco/shared/i18n-util";
import { writable } from "svelte/store";

import { env as publicEnv } from "$env/dynamic/public";

const PUBLIC_WEBLATE_COMPONENT_URL = publicEnv.PUBLIC_WEBLATE_COMPONENT_URL;
const PUBLIC_WEBLATE_API_KEY = publicEnv.PUBLIC_WEBLATE_API_KEY;
const LOCAL_STORAGE_KEY = "weblate_translation_overrides";

// TODO: update the rest of the code to use translationOverridesStore correctly
export const translationOverridesStore = writable({
	loading: true,
	lastFetched: null as Date | null
});

console.log(PUBLIC_WEBLATE_COMPONENT_URL);
// The function to fetch and update the data
export async function updateTranslationOverrides() {
	if (!PUBLIC_WEBLATE_COMPONENT_URL) {
		return;
	}
	console.log("Inside update");

	for (const language of Object.keys(loadedLocales)) {
		console.log("Loading language", language);
		const url = getLanguageUrl(PUBLIC_WEBLATE_COMPONENT_URL, language);
		if (!url) {
			console.error(`Invalid URL for language ${language}`);
			continue;
		}

		try {
			const headers: Record<string, string> = {};
			if (PUBLIC_WEBLATE_API_KEY) {
				headers["Authorization"] = `Token ${PUBLIC_WEBLATE_API_KEY}`;
			}
			const response = await fetch(url, {
				headers
			});

			if (response.ok) {
				const downloadedTranslations = await response.json();
				deepMergeInPlace(loadedLocales[language], downloadedTranslations);
			} else {
				console.error(`Failed to fetch translations for ${language}: ${response.statusText}`);
			}
		} catch (error) {
			console.error(`Error fetching translations for ${language}:`, error);
		}
	}
}

function getLanguageUrl(baseUrl: string, language: string) {
	/* Takes a weblate component URL like https://weblate.codemyriad.io/projects/librocco/web-client/
	   and a language like `it`. It returns a URL to download the updated translations, like
	   https://weblate.codemyriad.io/api/translations/librocco/web-client/it/file/
	*/
	try {
		// Ensure trailing slash for base URL for proper path joining
		const urlWithSlash = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
		const url = new URL(urlWithSlash);
		if (!url.pathname.startsWith("/projects/")) {
			return "";
		}
		const newPath = url.pathname.replace("/projects/", "/api/translations/") + `${language}/file/`;
		return new URL(newPath, url.origin).href;
	} catch (e) {
		// Invalid URL will throw, so catch and return empty string
		console.error(e);
		return "";
	}
}

function deepMergeInPlace(target, source) {
	Object.keys(source).forEach((key) => {
		if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
			if (!target[key] || typeof target[key] !== "object") {
				target[key] = {};
			}
			deepMergeInPlace(target[key], source[key]);
		} else if (source[key] !== "") {
			target[key] = source[key];
		}
	});
	return target;
}

// Export the reactive state for components to use
// XXX Do we really need this?
export const dataStore = {
	get data() {
		return translationOverrides.data;
	},
	get loading() {
		return translationOverrides.loading;
	},
	get lastFetched() {
		return translationOverrides.lastFetched;
	}
};
