import type { EntityListView } from "@librocco/shared";

import type { ContentInterface, DashboardNode, Subset } from "./types";

import { getHeader } from "./header";
import { getEntityList } from "./entityList";

export function getContent(_parent: DashboardNode): ContentInterface {
	const dashboard = _parent.dashboard;

	const container = Object.assign(dashboard().page().locator("#content"), { dashboard });

	const header = () => getHeader(getContent(_parent));

	const entityList = (view: EntityListView) => getEntityList(container, view);

	const navigate = (to: Subset<EntityListView, "warehouse-list" | "inbound-list">) =>
		container
			.locator(`[data-linkto="${to}"]`)
			.click()
			.then(() => entityList(to).waitFor());

	return Object.assign(container, { header, entityList, navigate });
}
