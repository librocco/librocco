export function prepareTranslations(base: any, override: any): any {
	if (Array.isArray(base)) return [...base];

	if (typeof base !== 'object' || base === null) return override;

	const result: Record<string, unknown> = {};

	const keys = new Set([...Object.keys(base), ...Object.keys(override ?? {})]);

	for (const key of keys) {
		const baseVal = base[key];
		const overrideVal = override?.[key];

		if (
			overrideVal === '' || // remove empty strings
			overrideVal === undefined ||
			(typeof overrideVal === 'object' && overrideVal !== null && Object.keys(overrideVal).length === 0)
		) {
			result[key] = baseVal;
		} else if (typeof baseVal === 'object' && typeof overrideVal === 'object') {
			result[key] = prepareTranslations(baseVal, overrideVal);
		} else {
			result[key] = overrideVal;
		}
	}

	return result;
}
