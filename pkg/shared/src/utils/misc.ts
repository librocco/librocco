/** Appends `.sqlite3` to a file name if the name doesn't already contain the extention, noop otherwise. */
export const addSQLite3Suffix = (name: string) => (name.endsWith(".sqlite3") ? name : name + ".sqlite3");

/**
 * Accepts an object and strips the null value fields (making them effectively undefined)
 * NOTE: This was a quick impl. for a particular use case, for broader use cases, the type signature might need updating
 */
export const stripNulls = <O extends Record<string, any>>(obj: O): O => {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null)) as O;
};
