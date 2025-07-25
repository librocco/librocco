import { loadedLocales } from "@librocco/shared/i18n-util";
import { writable, get } from "svelte/store";
import { getLanguageUrl } from "$lib/i18n-overrides-lib";
import { env as publicEnv } from "$env/dynamic/public";

const PUBLIC_WEBLATE_COMPONENT_URL = publicEnv.PUBLIC_WEBLATE_COMPONENT_URL;
const PUBLIC_WEBLATE_API_KEY = publicEnv.PUBLIC_WEBLATE_API_KEY;
const LOCAL_STORAGE_KEY = "weblate_translation_overrides";
const OVERRIDES_MAXAGE = 60;
export const TRANSLATION_OVERRIDES_ENABLED = !!PUBLIC_WEBLATE_COMPONENT_URL;

/* -------------------------------------------------------------------------- */
/*                               Helper types                                 */
/* -------------------------------------------------------------------------- */

type TranslationOverridesState = {
	/** Per-language overrides merged into loadedLocales */
	overrides: Record<string, unknown>;
	/** Epoch-ms timestamp of the last successful fetch */
	lastFetched: number | null;
	/** Network request in flight */
	loading: boolean;
};

/* -------------------------------------------------------------------------- */
/*                           Persisted Svelte store                           */
/* -------------------------------------------------------------------------- */

function persisted<T>(key: string, initial: T) {
	if (typeof localStorage === "undefined") return;
	const store = writable(initial);

	const json = localStorage.getItem(key);
	if (json) store.set(JSON.parse(json));

	store.subscribe((value) => {
		localStorage.setItem(key, JSON.stringify(value));
	});

	return store;
}

export const translationOverridesStore = persisted<TranslationOverridesState>(LOCAL_STORAGE_KEY, {
	overrides: {},
	lastFetched: null,
	loading: false
});

/* -------------------------------------------------------------------------- */
/*                         Public fetch/update function                       */
/* -------------------------------------------------------------------------- */

export async function updateTranslationOverrides(opts: { notOlderThanSecs?: number } = {}): Promise<TranslationOverridesState> {
	if (!TRANSLATION_OVERRIDES_ENABLED) return;
	const current: TranslationOverridesState = get(translationOverridesStore);

	const freshnessSecs = opts.notOlderThanSecs ?? OVERRIDES_MAXAGE;

	/* ---------- Use cached value if still fresh ---------- */
	if (current.lastFetched && Date.now() - current.lastFetched < freshnessSecs * 1_000) {
		applyOverridesToLoadedLocales(current.overrides);
		return current;
	}

	translationOverridesStore.update((s) => ({ ...s, loading: true }));

	/* ------------------------ Fetch ----------------------- */
	const newOverrides: Record<string, unknown> = {};

	for (const language of Object.keys(loadedLocales)) {
		const url = getLanguageUrl(PUBLIC_WEBLATE_COMPONENT_URL, language);
		if (!url) continue;

		const headers: Record<string, string> = {};
		if (PUBLIC_WEBLATE_API_KEY) {
			headers["Authorization"] = `Token ${PUBLIC_WEBLATE_API_KEY}`;
		}

		const res = await fetch(url, { headers });
		if (res.ok) {
			newOverrides[language] = await res.json();
		}
	}

	applyOverridesToLoadedLocales(newOverrides);

	const newState: TranslationOverridesState = {
		overrides: newOverrides,
		lastFetched: Date.now(),
		loading: false
	};
	translationOverridesStore.set(newState);
	return newState;
}

/* -------------------------------------------------------------------------- */
/*                                Internals                                   */
/* -------------------------------------------------------------------------- */

function applyOverridesToLoadedLocales(overrides: Record<string, unknown>) {
	for (const [lang, data] of Object.entries(overrides)) {
		if (!loadedLocales[lang]) continue;
		deepMergeInPlace(loadedLocales[lang], data);
	}
}

function deepMergeInPlace(target: any, source: any): any {
	if (!target || !source) return target;
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
