import { base } from "$app/paths";

export const links = [
	{
		label: "Stock",
		href: `${base}/inventory/stock/`
	},
	{
		label: "Inbound",
		href: `${base}/inventory/inbound/`
	},
	{
		label: "Outbound",
		href: `${base}/inventory/outbound/`
	},
	{ label: "Settings", href: `${base}/settings/` }
];
