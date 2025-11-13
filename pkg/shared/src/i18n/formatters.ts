import type { FormattersInitializer } from 'typesafe-i18n'
import type { Locales, Formatters } from './i18n-types'

export const initFormatters: FormattersInitializer<Locales, Formatters> = (locale: Locales) => {
	// Map simple locale codes to full BCP 47 language tags
	// This ensures consistent behavior across all browsers and environments
	const localeMap: Record<Locales, string> = {
		'en': 'en-US',
		'de': 'de-DE',
		'it': 'it-IT'
	};

	const fullLocale = localeMap[locale];

	const formatters: Formatters = {
		// Date formatters for consistent, locale-aware date formatting across the app

		// Short date format: month + day only (no year)
		// Examples: "Jan 13" (en), "13 gen" (it)
		dateShort: (date: Date | string): string =>
			new Date(date).toLocaleDateString(fullLocale, {
				month: 'short',
				day: 'numeric'
			}),

		// Medium date format: month + day + year
		// Examples: "Jan 13, 2024" (en), "13 gen 2024" (it)
		dateMedium: (date: Date | string): string =>
			new Date(date).toLocaleDateString(fullLocale, {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			}),

		// Full date and time format
		// Examples: "Jan 13, 2024, 3:45 PM" (en), "13 gen 2024, 15:45" (it)
		dateTime: (date: Date | string): string =>
			new Date(date).toLocaleDateString(fullLocale, {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				hour: '2-digit',
				minute: 'numeric'
			}),

		// Time only format
		// Examples: "3:45 PM" (en), "15:45" (it)
		timeOnly: (date: Date | string): string =>
			new Date(date).toLocaleTimeString(fullLocale, {
				hour: '2-digit',
				minute: 'numeric'
			})
	}

	return formatters
}
