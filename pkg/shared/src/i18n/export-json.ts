import fs from 'fs'
import path from 'path'
import { locales, baseLocale } from './i18n-util'
import type { BaseTranslation } from './i18n-types'
import en from './en/index'

// Util: recursively merge and prune
function syncLocaleWithBase(base: any, target: any): any {
	const result: any = {}

	for (const key in base) {
		const targetVal = target?.[key]
		if (typeof base[key] === 'object' && base[key] !== null && !Array.isArray(base[key])) {
			const targetObj = typeof targetVal === 'object' && targetVal !== null && !Array.isArray(targetVal) ? targetVal : {}
			result[key] = syncLocaleWithBase(base[key], targetObj)
		} else {
			// Keep the existing value only if its type matches the base value - prunes stale structures
			// (e.g. an object left shadowing a base string after a key was flattened)
			result[key] = typeof targetVal === typeof base[key] ? targetVal : ''
		}
	}

	return result
}

// Util: write to disk
async function writeJson(locale: string, data: object) {
	const filePath = path.resolve(`src/i18n/${locale}/index.json`)
	await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
	await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
	console.log(`✅ ${locale}/index.json updated`)
}

// Main export process
async function exportAllLocales() {
	const baseData: BaseTranslation = en

	for (const locale of locales) {
		if (locale === baseLocale) {
			await writeJson(locale, baseData)
			continue
		}

		const targetPath = path.resolve(`src/i18n/${locale}/index.json`)
		let existing: any = {}

		try {
			const content = await fs.promises.readFile(targetPath, 'utf-8')
			existing = JSON.parse(content)
		} catch {
			console.warn(`ℹ️ No existing file for ${locale}, starting fresh`)
		}

		const merged = syncLocaleWithBase(baseData, existing)
		await writeJson(locale, merged)
	}
}

exportAllLocales().catch((err) => {
	console.error('❌ Failed to export translations:', err)
	process.exit(1)
})
