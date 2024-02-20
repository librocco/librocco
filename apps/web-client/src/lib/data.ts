import { Building, CopyPlus } from "lucide-svelte";
import { appPath } from "./paths";
import { entityListView } from "@librocco/shared";

export const inventoryTabs = [
	{
		icon: Building,
		label: "Warehouses",
		href: appPath("warehouses"),
		linkto: entityListView("warehouse-list")
	},
	{
		icon: CopyPlus,
		label: "Inbound",
		href: appPath("inbound"),
		linkto: entityListView("inbound-list")
	}
];

export const publisherList = ["TCK Publishing", "Reed Elsevier", "Penguin Random House", "Harper Collins", "Bloomsbury"];
