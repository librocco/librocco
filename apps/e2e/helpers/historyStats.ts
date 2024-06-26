import { expect } from "@playwright/test";

import { DashboardNode, HistoryStatsInterface, HistoryStatsValues, StatsField, WaitForOpts } from "./types";

import { assertionTimeout } from "@/constants";

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
