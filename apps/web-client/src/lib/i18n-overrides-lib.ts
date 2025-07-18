export function getLanguageUrl(baseUrl: string, language: string) {
	try {
		const urlWithSlash = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
		const url = new URL(urlWithSlash);
		if (!url.pathname.startsWith("/projects/")) return "";
		const newPath = url.pathname.replace("/projects/", "/api/translations/") + `${language}/file/`;
		return new URL(newPath, url.origin).href;
	} catch {
		return "";
	}
}
