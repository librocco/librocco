// truthy/falsey literals (immutable)
const truthy = Object.freeze(new Set(["t", "true", "y", "yes", "on", "1"]));

/**
 * Coerce an arbitrary value to boolean, mirroring the Python `asbool`.
 *
 * - `null`/`undefined` → `false`
 * - native booleans    → returned unchanged
 * - everything else    → lower‑cased string tested against `truthy`
 *
 * Anything not in `truthy` is treated as `false`.
 */
function asBool(value) {
	if (value === null || value === undefined) return false;
	if (typeof value === "boolean") return value;
	const s = String(value).trim().toLowerCase();
	return truthy.has(s);
}

export const USE_SUBMODULES = asBool(process.env.USE_SUBMODULES);
export const IS_DEMO = asBool(process.env.PUBLIC_IS_DEMO);
