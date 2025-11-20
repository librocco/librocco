import { derived, get } from 'svelte/store'

import type { Locales } from './i18n-types'
import { baseLocale, locales } from './i18n-util'
import { locale as localeStore } from './i18n-svelte'

const localeMap: Record<Locales, string> = {
	de: 'de-DE',
	en: 'en-US',
	it: 'it-IT'
}

const fallbackLocale: Locales = baseLocale

const parseDate = (value: Date | string | number | null | undefined): Date | null => {
	if (value === null || value === undefined) return null

	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value
	}

	if (typeof value === 'number') {
		const parsed = new Date(value)
		return Number.isNaN(parsed.getTime()) ? null : parsed
	}

	if (typeof value === 'string') {
		if (value.trim() === '') return null
		const parsed = new Date(value)
		return Number.isNaN(parsed.getTime()) ? null : parsed
	}

	return null
}

const formatWith = (formatter: Intl.DateTimeFormat, value: Date | string | number | null | undefined): string => {
	const date = parseDate(value)
	return date ? formatter.format(date) : ''
}

const resolveLocale = (value: Locales | string | undefined): Locales =>
	locales.includes(value as Locales) ? (value as Locales) : fallbackLocale

const createFormatters = (locale: Locales) => {
	const resolved = localeMap[locale] ?? localeMap[fallbackLocale]

	const shortFormatter = new Intl.DateTimeFormat(resolved, {
		month: 'short',
		day: 'numeric'
	})

	const mediumFormatter = new Intl.DateTimeFormat(resolved, {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	})

	const dateTimeFormatter = new Intl.DateTimeFormat(resolved, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	})

	const timeFormatter = new Intl.DateTimeFormat(resolved, {
		hour: '2-digit',
		minute: '2-digit'
	})

	return {
		dateShort: (value: Date | string | number | null | undefined) => formatWith(shortFormatter, value),
		dateMedium: (value: Date | string | number | null | undefined) => formatWith(mediumFormatter, value),
		dateTime: (value: Date | string | number | null | undefined) => formatWith(dateTimeFormatter, value),
		timeOnly: (value: Date | string | number | null | undefined) => formatWith(timeFormatter, value)
	}
}

const initialFormatters = createFormatters(fallbackLocale)

export const formatters = derived(localeStore, ($locale) => createFormatters(resolveLocale($locale)), initialFormatters)

export const getFormatters = () => get(formatters)

export const dateShort = (value: Date | string | number | null | undefined): string => getFormatters().dateShort(value)
export const dateMedium = (value: Date | string | number | null | undefined): string => getFormatters().dateMedium(value)
export const dateTime = (value: Date | string | number | null | undefined): string => getFormatters().dateTime(value)
export const timeOnly = (value: Date | string | number | null | undefined): string => getFormatters().timeOnly(value)
