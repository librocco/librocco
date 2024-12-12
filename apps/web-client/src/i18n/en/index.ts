// TODO: it'd be nice to typecheck the dict e.g `const en = {} satisfies BaseTranslation` but it's not working right now
// import type { BaseTranslation } from '../i18n-types.js'

const nav = {
	// Inventory mgmt
	search: "Search stock",
	inventory: "Manage inventory",
	outbound: "Outbound",
	inbound: "Inbound",
	settings: "Settings",
	history: "History",

	// Orders mgmt
	supplier_orders: "Suppliers orders",
	debug: "Debug"
};

const search = {
	title: "Search",
	empty: {
		title: "Search for stock",
		description: "Get started by searching by title, author, ISBN"
	}
};

const en = {
	nav,
	search
};

export default en;
