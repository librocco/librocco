import type { EntityListView } from "@librocco/shared";

import type { ContentInterface, DashboardNode, Subset, TableView } from "./types";

import { getHeader } from "./header";
import { getEntityList } from "./entityList";
import { getScanField } from "./scanField";
import { getEntriesTable } from "./table";
import { selector, testIdSelector } from "./utils";

export function getContent(_parent: DashboardNode): ContentInterface {
	const dashboard = _parent.dashboard;

	const container = Object.assign(dashboard().page().locator("#content"), { dashboard });

	const header = () => getHeader(getContent(_parent));

	const entityList = (view: EntityListView) => getEntityList(container, view);

	const scanField = () => getScanField(container);
	const searchField = () => container.locator(selector(testIdSelector("search-input")));

	const table = (view: TableView) => getEntriesTable(container, view);

	const navigate = (to: Subset<EntityListView, "warehouse-list" | "inbound-list">) =>
		container
			.locator(`[data-linkto="${to}"]`)
			.click()
			.then(() => entityList(to).waitFor());

	return Object.assign(container, { header, entityList, navigate, scanField, searchField, table });
}
