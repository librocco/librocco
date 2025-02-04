import { redirect } from "@sveltejs/kit";
import { fromDate, getLocalTimeZone } from "@internationalized/date";

import type { PageLoad } from "./$types";
import type { PastTransactionItem } from "$lib/db/cr-sqlite/types";

import { appPath } from "$lib/paths";
import { getPastTransactions } from "$lib/db/cr-sqlite/history";

export const load: PageLoad = async ({ params: { date }, parent, depends }) => {
	depends("history:transactions");

	const { dbCtx } = await parent();

	// Validate the date - if not valid, redirect to default
	if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
		throw redirect(307, appPath("history/date", new Date().toISOString().slice(0, 10)));
	}

	// Prepare the date for usage with date picker
	const dateValue = fromDate(new Date(date), getLocalTimeZone());

	const stats = {
		totalInboundBookCount: 0,
		totalInboundCoverPrice: 0,
		totalOutboundBookCount: 0,
		totalOutboundCoverPrice: 0,
		totalOutboundDiscountedPrice: 0,
		totalInboundDiscountedPrice: 0
	};

	// We're not in the browser, no need for further loading
	if (!dbCtx) {
		return { date, dateValue, bookList: [] as PastTransactionItem[], stats };
	}

	const startDate = new Date(date);
	const endDate = startDate;
	const bookList: PastTransactionItem[] = await getPastTransactions(dbCtx.db, { startDate, endDate });

	for (const { noteType, discount = 0, price, quantity } of bookList) {
		if (noteType === "inbound") {
			stats.totalInboundBookCount += quantity;
			stats.totalInboundCoverPrice += quantity * price;
			stats.totalInboundDiscountedPrice += (quantity * price * (100 - discount)) / 100;
		} else {
			stats.totalOutboundBookCount += quantity;
			stats.totalOutboundCoverPrice += quantity * price;
			stats.totalOutboundDiscountedPrice += (quantity * price * (100 - discount)) / 100;
		}
	}

	return { date, dateValue, bookList, stats };
};

export interface DailySummaryStore {}
