import { loadedLocales } from "@librocco/shared/i18n-util";
import { devSettingsStore } from "$lib/stores/dev";

async function loadTranslationsOverrides(value) {
	const { translationsAPIKey, customTranslations, translationsUrl } = value;
	console.log("Ignoring customTranslations for now: it's not persisted because of a form bug (I think)", customTranslations);
	if (!translationsUrl) {
		return;
	}

	for (const language of Object.keys(loadedLocales)) {
		console.log("Loading language", language);
		const url = getLanguageUrl(translationsUrl, language);
		if (!url) {
			console.error(`Invalid URL for language ${language}`);
			continue;
		}

		try {
			const headers: Record<string, string> = {};
			if (translationsAPIKey) {
				headers["Authorization"] = `Token ${translationsAPIKey}`;
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

export async function initTranslationsOverrides() {
	// const unsubscribe =
	devSettingsStore.subscribe(loadTranslationsOverrides);
	// HElp! When do I unsubscribe?
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

export function getLanguageUrl(baseUrl: string, language: string) {
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
