import { date } from 'typesafe-i18n/formatters'
import type { FormattersInitializer } from 'typesafe-i18n'
import type { Locales, Formatters } from './i18n-types'

const localeMap: Record<Locales, string> = {
	de: 'de-DE',
	en: 'en-US',
	it: 'it-IT'
}

const resolveLocale = (locale: Locales): string => localeMap[locale] ?? localeMap.en

export const initFormatters: FormattersInitializer<Locales, Formatters> = (locale: Locales) => {
	const resolved = resolveLocale(locale)

	const formatters = {
		dateShort: date(resolved, {
			month: 'short',
			day: 'numeric'
		})
	} satisfies Formatters

	return formatters
}
