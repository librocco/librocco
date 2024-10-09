/** Appends `.sqlite3` to a file name if the name doesn't already contain the extention, noop otherwise. */
export const addSQLite3Suffix = (name: string) => (name.endsWith(".sqlite3") ? name : name + ".sqlite3");
