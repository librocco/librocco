import type { FormattersInitializer } from "typesafe-i18n";
import type { Locales, Formatters } from "./i18n-types.js";

// * note: fn accepts param locale: Locales
export const initFormatters: FormattersInitializer<Locales, Formatters> = () => {
	const formatters: Formatters = {
		// add your formatter functions here
	};

	return formatters;
};
