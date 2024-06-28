import type { EntityListView, TestId, WebClientView } from "@librocco/shared";

import type {
	ContentInterface,
	DashboardNode,
	HistoryTableInterface,
	InventoryTableInterface,
	InventoryTableView,
	Subset,
	TableView
} from "./types";

import { getHeader } from "./header";
import { getEntityList } from "./entityList";
import { getScanField } from "./scanField";
import { getHistoryTable, getInventoryTable } from "./table";
// import { selector, testIdSelector } from "./utils";
import { getCalendar } from "./calendar";
import { getHistoryStats, getStockReport } from "./history";
import { getSearchField } from "./searchField";

export function getContent(_parent: DashboardNode): ContentInterface {
	const dashboard = _parent.dashboard;

	const container = Object.assign(dashboard().page().locator("#content"), { dashboard });

	const header = () => getHeader(getContent(_parent));

	const entityList = (view: EntityListView) => getEntityList(container, view);

	const scanField = () => getScanField(container);
	const searchField = () => getSearchField(container);

	const table = <V extends TableView>(view: V): V extends InventoryTableView ? InventoryTableInterface : HistoryTableInterface => {
		const isInventoryView = (view: TableView): view is InventoryTableView =>
			["inbound-note", "outbound-note", "stock", "warehouse"].includes(view);
		return isInventoryView(view) ? getInventoryTable(container, view) : (getHistoryTable(container, view) as any);
	};

	const navigate = (
		to:
			| Subset<EntityListView, "warehouse-list" | "inbound-list">
			| Subset<WebClientView, "history/date" | "history/isbn" | "history/notes" | "history/warehouse">
	) =>
		container
			.locator(`[data-linkto="${to}"]`)
			.click()
			.then(() =>
				["warehouse-list", "inbound-list"].includes(to)
					? entityList(to as EntityListView).waitFor()
					: dashboard()
							.view(to as WebClientView)
							.waitFor()
			);

	const calendar = (id?: TestId) => getCalendar(container, id);

	const historyStats = () => getHistoryStats(container);

	const stockReport = () => getStockReport(container);

	return Object.assign(container, { header, entityList, navigate, scanField, searchField, table, calendar, historyStats, stockReport });
}
