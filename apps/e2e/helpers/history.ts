import { expect } from "@playwright/test";

import { DashboardNode, HistoryStatsInterface, HistoryStatsValues, StatsField, StockReportInterface, WaitForOpts } from "./types";

import { assertionTimeout } from "@/constants";
import { selector, testIdSelector } from "./utils";

function getHistoryStatsField(parent: DashboardNode, name: string, precision: number): StatsField {
	const assert = (want: number, opts?: WaitForOpts) =>
		expect(parent.locator(`[data-property="${name}"]`)).toHaveText(want.toFixed(precision), { timeout: assertionTimeout, ...opts });
	return { assert };
}

export function getHistoryStats(parent: DashboardNode): HistoryStatsInterface {
	const dashboard = parent.dashboard;

	const container = parent;

	const inboundCount = () => getHistoryStatsField(parent, "inbound-count", 0);
	const inboundCoverPrice = () => getHistoryStatsField(parent, "inbound-cover-price", 2);
	const inboundDiscountedPrice = () => getHistoryStatsField(parent, "inbound-discounted-price", 2);
	const outboundCount = () => getHistoryStatsField(parent, "outbound-count", 0);
	const outboundCoverPrice = () => getHistoryStatsField(parent, "outbound-cover-price", 2);
	const outboundDiscountedPrice = () => getHistoryStatsField(parent, "outbound-discounted-price", 2);

	const assert = async (values: HistoryStatsValues) => {
		await inboundCount().assert(values.inboundCount);
		await inboundCoverPrice().assert(values.inboundCoverPrice);
		await inboundDiscountedPrice().assert(values.inboundDiscountedPrice);
		await outboundCount().assert(values.outboundCount);
		await outboundCoverPrice().assert(values.outboundCoverPrice);
		await outboundDiscountedPrice().assert(values.outboundDiscountedPrice);
	};

	return Object.assign(container, {
		dashboard,
		inboundCount,
		inboundCoverPrice,
		inboundDiscountedPrice,
		outboundCount,
		outboundCoverPrice,
		outboundDiscountedPrice,
		assert
	});
}

export function getStockReport(parent: DashboardNode): StockReportInterface {
	const dashboard = parent.dashboard;
	const container = parent.locator(selector(testIdSelector("history-stock-report")));

	const assert = async (values: [string, number][]) => {
		const locator = container.locator(selector(testIdSelector("history-stock-report-entry")));

		// Instead of asserting the number of elements, we're doing this in a repeatable manner by
		// asserting that the last (nth) expcted element exists and the next one (n+1th) doesn't
		await locator.nth(values.length - 1).waitFor();
		await locator.nth(values.length).waitFor({ state: "detached" });

		// Match elements and wanted values (the order is not important)
		await Promise.all(
			values.map(([warehouseId, quantity]) => {
				const loc = container.locator(`[data-testid="history-stock-report-entry"][data-warehouse="${warehouseId}"]`);
				return Promise.all([
					loc.waitFor(),
					expect(loc.locator(`[data-property="warehouse"]`)).toHaveText(warehouseId),
					expect(loc.locator(`[data-property="quantity"]`)).toHaveText(quantity.toString())
				]);
			})
		);
	};

	return Object.assign(container, { dashboard, assert });
}
