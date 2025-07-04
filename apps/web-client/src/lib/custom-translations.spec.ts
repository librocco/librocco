/** @vitest-environment node */

import { describe, it, expect } from "vitest";
import { getLanguageUrl } from "./custom-translations";

describe("getLanguageUrl", () => {
	it("should return the correct URL for a valid weblate URL with a trailing slash", () => {
		const baseUrl = "https://weblate.codemyriad.io/projects/librocco/web-client/";
		const language = "it";
		const expectedUrl = "https://weblate.codemyriad.io/api/translations/librocco/web-client/it/file/";
		expect(getLanguageUrl(baseUrl, language)).toBe(expectedUrl);
	});

	it("should return the correct URL for a valid weblate URL without a trailing slash", () => {
		const baseUrl = "https://weblate.codemyriad.io/projects/librocco/web-client";
		const language = "fr";
		const expectedUrl = "https://weblate.codemyriad.io/api/translations/librocco/web-client/fr/file/";
		expect(getLanguageUrl(baseUrl, language)).toBe(expectedUrl);
	});

	it("should return an empty string for a URL that does not point to a weblate projects path", () => {
		const baseUrl = "https://example.com/some/other/path/";
		const language = "de";
		expect(getLanguageUrl(baseUrl, language)).toBe("");
	});

	it("should return an empty string for an invalid URL", () => {
		const baseUrl = "not a valid url";
		const language = "es";
		expect(getLanguageUrl(baseUrl, language)).toBe("");
	});

	it("should handle different languages correctly", () => {
		const baseUrl = "https://weblate.codemyriad.io/projects/librocco/web-client/";
		const language = "zh-Hans";
		const expectedUrl = "https://weblate.codemyriad.io/api/translations/librocco/web-client/zh-Hans/file/";
		expect(getLanguageUrl(baseUrl, language)).toBe(expectedUrl);
	});

	it("should handle different project and component names", () => {
		const baseUrl = "https://weblate.example.com/projects/another-project/another-component/";
		const language = "ja";
		const expectedUrl = "https://weblate.example.com/api/translations/another-project/another-component/ja/file/";
		expect(getLanguageUrl(baseUrl, language)).toBe(expectedUrl);
	});
});
