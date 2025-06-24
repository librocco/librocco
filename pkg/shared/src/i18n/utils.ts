export function removeEmptyStrings(obj: any): any {
	if (Array.isArray(obj)) {
		return obj.map(removeEmptyStrings)
	}

	if (typeof obj === 'object' && obj !== null) {
		const cleaned: any = {}
		for (const [key, value] of Object.entries(obj)) {
			if (value === '') continue
			if (typeof value === 'object') {
				const nested = removeEmptyStrings(value)
				if (Object.keys(nested).length > 0) {
					cleaned[key] = nested
				}
			} else {
				cleaned[key] = value
			}
		}
		return cleaned
	}

	return obj
}
