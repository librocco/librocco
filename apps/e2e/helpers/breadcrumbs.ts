import { BreadcrumbsInterface, DashboardNode, WaitForOpts } from "./types";
import { compareEntries } from "./utils";

export function getBreadcrumbs(_parent: DashboardNode): BreadcrumbsInterface {
	const dashboard = _parent.dashboard;
	const container = _parent.locator("nav#breadcrumbs");

	const assert = async (labels: string[], opts?: WaitForOpts) => compareEntries(container, labels, "li", opts);

	return Object.assign(container, { assert, dashboard });
}
