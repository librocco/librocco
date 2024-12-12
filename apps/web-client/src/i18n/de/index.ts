// TODO: it'd be nice to typecheck the dict e.g `const de = {} satisfies Transaltion` but it's not working right now
// import type { Translation } from '../i18n-types.js'

const nav = {
	search: "Bestände suchen",
	inventory: "Inventar verwalten",
	outbound: "Ausgehend",
	inbound: "Eingehend",
	settings: "Einstellungen",
	history: "Verlauf",

	supplier_orders: "Lieferantenbestellungen",
	debug: "Debug"
};

const search = {
	title: "Suche",
	empty: {
		title: "Nach Beständen suchen",
		description: "Beginnen Sie mit der Suche nach Titel, Autor, ISBN"
	}
};

const de = {
	nav,
	search
};

export default de;
