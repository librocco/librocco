import { base } from "$app/paths";

const basepath = `${base}`;

const PATHS = {
	stock: `${basepath}/stock/`,
	warehouses: `${basepath}/inventory/warehouses/`,
	inventory: `${basepath}/inventory/`,
	inbound: `${basepath}/inventory/inbound/`,
	outbound: `${basepath}/outbound/`,
	settings: `${basepath}/settings/`
};

/**
 * We're using this util to construct app paths. This is preferable to using constants as it
 * allows us to construct paths with dynamic segments, while performing some additional sanitization:
 * - requires the first segment to be the location key (e.g. "stock", "inventory", etc.)
 * - joins all of the segments with "/"
 * - ensures that the path ends with "/" (adds a trailing slash if neecessary)
 * - ensutres that there are no double slashes in the path
 * (often a result of joining constants + dynamis segments, e.g. `${base}/stock/${id}` -> base might or might not end with a slash)
 * @param location - the location key (e.g. "stock", "inventory", etc.)
 * @param segments - the dynamic segments of the path
 */
export const appPath = (location: keyof typeof PATHS, ...segments: string[]) =>
	[PATHS[location], ...segments].join("/").concat("/").replaceAll("//", "/");
