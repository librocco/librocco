import type { BaseTranslation } from "typesafe-i18n";
import { storeTranslationToDisk, type ImportLocaleMapping } from "typesafe-i18n/importer";
import type { Locales } from "./i18n-types";
import { locales } from "./i18n-util";
import fs from "fs";
import path from "path";

const getDataFromJSON = async (locale: Locales): Promise<BaseTranslation> => {
	const jsonPath = path.resolve(`src/i18n/${locale}/index.json`);

	try {
		const fileContent = await fs.promises.readFile(jsonPath, "utf-8");
		return JSON.parse(fileContent);
	} catch (error) {
		console.error(`Error reading JSON file for locale '${locale}':`, error);
		return {};
	}
};

const importTranslationsForLocale = async (locale: Locales) => {
	const translations = await getDataFromJSON(locale);

	const localeMapping: ImportLocaleMapping = {
		locale,
		translations
	};

	const result = await storeTranslationToDisk(localeMapping);

	console.log(`translations imported for locale '${result}'`);
};

// Import translations for all available locales
const importAllTranslations = async () => {
	for (const locale of locales) {
		await importTranslationsForLocale(locale);
	}
};

importAllTranslations();
