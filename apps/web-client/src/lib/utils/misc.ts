/**
 * A util used to compare two paths. It trims the paths and removes the leading and trailing slashes
 * for clean comparison.
 * @example
 * ```ts
 * comparePaths("/foo/bar", "foo/bar"); // true
 * comparePaths("foo/bar", "foo/bar/"); // true
 * ```
 */
export const comparePaths = (...paths: [string, string]) => {
	const trimmed = paths.map((l) => l.trim().replace(/^\//, "").replace(/\/$/g, ""));
	return trimmed[0] === trimmed[1];
};
