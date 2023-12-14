import { base } from "$app/paths";

const basepath = `${base}/proto`;

export const PROTO_PATHS = {
	STOCK: `${basepath}/stock/`,
	WAREHOUSES: `${basepath}/inventory/warehouses/`,
	INVENTORY: `${basepath}/inventory/`,
	INBOUND: `${basepath}/inventory/inbound/`,
	OUTBOUND: `${basepath}/outbound/`,
	SETTINGS: `${basepath}/settings/`
};
