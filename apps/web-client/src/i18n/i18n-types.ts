// This file was auto-generated by 'typesafe-i18n'. Any manual changes will be overwritten.
/* eslint-disable */
import type { BaseTranslation as BaseTranslationType, LocalizedString } from 'typesafe-i18n'

export type BaseTranslation = BaseTranslationType
export type BaseLocale = 'en'

export type Locales =
	| 'de'
	| 'en'

export type Translation = RootTranslation

export type Translations = RootTranslation

type RootTranslation = {
	nav: {
		/**
		 * S​e​a​r​c​h​ ​s​t​o​c​k
		 */
		search: string
		/**
		 * M​a​n​a​g​e​ ​i​n​v​e​n​t​o​r​y
		 */
		inventory: string
		/**
		 * O​u​t​b​o​u​n​d
		 */
		outbound: string
		/**
		 * I​n​b​o​u​n​d
		 */
		inbound: string
		/**
		 * S​e​t​t​i​n​g​s
		 */
		settings: string
		/**
		 * H​i​s​t​o​r​y
		 */
		history: string
		/**
		 * S​u​p​p​l​i​e​r​s​ ​o​r​d​e​r​s
		 */
		supplier_orders: string
	}
	search: {
		/**
		 * S​e​a​r​c​h
		 */
		title: string
		empty: {
			/**
			 * S​e​a​r​c​h​ ​f​o​r​ ​s​t​o​c​k
			 */
			title: string
			/**
			 * G​e​t​ ​s​t​a​r​t​e​d​ ​b​y​ ​s​e​a​r​c​h​i​n​g​ ​b​y​ ​t​i​t​l​e​,​ ​a​u​t​h​o​r​,​ ​I​S​B​N
			 */
			description: string
		}
	}
}

export type TranslationFunctions = {
	nav: {
		/**
		 * Search stock
		 */
		search: () => LocalizedString
		/**
		 * Manage inventory
		 */
		inventory: () => LocalizedString
		/**
		 * Outbound
		 */
		outbound: () => LocalizedString
		/**
		 * Inbound
		 */
		inbound: () => LocalizedString
		/**
		 * Settings
		 */
		settings: () => LocalizedString
		/**
		 * History
		 */
		history: () => LocalizedString
		/**
		 * Suppliers orders
		 */
		supplier_orders: () => LocalizedString
	}
	search: {
		/**
		 * Search
		 */
		title: () => LocalizedString
		empty: {
			/**
			 * Search for stock
			 */
			title: () => LocalizedString
			/**
			 * Get started by searching by title, author, ISBN
			 */
			description: () => LocalizedString
		}
	}
}

export type Formatters = {}
