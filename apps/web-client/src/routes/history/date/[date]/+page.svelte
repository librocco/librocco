<script lang="ts">
	import { Library, ArrowLeft, ArrowRight } from "lucide-svelte";
	import { now, getLocalTimeZone, type DateValue } from "@internationalized/date";

	import { entityListView, testId } from "@librocco/shared";

	import { goto } from "$lib/utils/navigation";
	import { browser } from "$app/environment";

	import type { PageData } from "./$types";

	import { HistoryPage, PlaceholderBox, CalendarPicker } from "$lib/components";

	import { createDailySummaryStore } from "$lib/stores/inventory/history_entries";

	import { getDB } from "$lib/db";

	import { appPath } from "$lib/paths";
	import { generateUpdatedAtString } from "$lib/utils/time";

	export let data: PageData;

	// #region date picker
	const isEqualDateValue = (a?: DateValue, b?: DateValue): boolean => {
		if (!a || !b) return false;
		return a.toString().slice(0, 10) === b.toString().slice(0, 10);
	};
	const defaultDateValue = data.dateValue;
	const onDateValueChange = ({ next }) => {
		// Redirect only in browser, if data value is different then the one in route param
		if (browser && !isEqualDateValue(data.dateValue, next)) {
			// The replaceState part allows us to have the date as part of the route (for sharing/reaload),
			// whilst keeping the date changes a single history entry (allowing for quick 'back' navigation)
			goto(appPath("history/date", next.toString().slice(0, 10)), { replaceState: true });
		}
		return next;
	};
	const isDateDisabled = (date: DateValue) => {
		return date > now(getLocalTimeZone());
	};
	// #endregion date picker

	const { db, status } = getDB();
	if (!status) goto(appPath("settings"));

	const dailySummaryCtx = { name: "[DAILY_SUMMARY]", debug: false };
	$: dailySummary = createDailySummaryStore(dailySummaryCtx, db, data.date);
</script>

<HistoryPage view="history/date">
	<svelte:fragment slot="heading">
		<div class="flex w-full justify-between">
			<h1 class="text-2xl font-bold leading-7 text-gray-900">History</h1>

			<div class="flex w-full flex-col items-center gap-3">
				<CalendarPicker onValueChange={onDateValueChange} defaultValue={defaultDateValue} {isDateDisabled} />
			</div>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<!-- Start entity list contaier -->

		<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
		<div class={testId("entity-list-container")} data-view={entityListView("outbound-list")} data-loaded={true}>
			{#if !$dailySummary?.bookList?.length}
				<!-- Start entity list placeholder -->
				<PlaceholderBox title="No Books on that date" description="Try selecting a different date." class="center-absolute" />
				<!-- End entity list placeholder -->
			{:else}
				<h2 class="px-4 py-4 pt-8 text-xl font-semibold">Stats</h2>

				<div data-testid={testId("history-date-stats")}>
					<div class="flex flex-row text-sm">
						<div class="badge badge-green m-2 p-2 font-bold">
							Inbound Book Count: <span data-property="inbound-count">{$dailySummary.stats.totalInboundBookCount}</span>
						</div>
						<div class="badge badge-green m-2 p-2 font-bold">
							Inbound Cover Price: <span data-property="inbound-cover-price">{$dailySummary.stats.totalInboundCoverPrice.toFixed(2)}</span>
						</div>
						<div class="badge badge-green m-2 p-2 font-bold">
							Inbound Discounted Price: <span data-property="inbound-discounted-price"
								>{$dailySummary.stats.totalInboundDiscountedPrice.toFixed(2)}</span
							>
						</div>
					</div>

					<div class="flex flex-row text-sm">
						<div class="badge badge-red m-2 p-2 font-bold">
							Outbound Book Count: <span data-property="outbound-count">{$dailySummary.stats.totalOutboundBookCount}</span>
						</div>
						<div class="badge badge-red m-2 p-2 font-bold">
							Outbound Cover Price: <span data-property="outbound-cover-price"
								>{$dailySummary.stats.totalOutboundCoverPrice.toFixed(2)}</span
							>
						</div>
						<div class="badge badge-red m-2 p-2 font-bold">
							Outbound Discounted Price: <span data-property="outbound-discounted-price"
								>{$dailySummary.stats.totalOutboundDiscountedPrice.toFixed(2)}</span
							>
						</div>
					</div>
				</div>

				<h2 class="px-4 py-4 pt-8 text-xl font-semibold">Transactions</h2>

				<div id="history-table" class="w-full">
					<ul class="w-full divide-y divide-gray-300">
						{#each $dailySummary.bookList as entry}
							{@const isbn = entry.isbn}
							{@const title = entry.title}
							{@const quantity = entry.quantity}
							{@const warehouseName = entry.warehouseName}
							{@const committedAt = entry.date}
							{@const noteType = entry.noteType}
							{@const noteName = entry.noteDisplayName}
							{@const noteId = entry.noteId}

							<!--<div class="w-full text-gray-700">
								<p class="mt-2 mb-1 text-sm font-semibold leading-none text-gray-900">{isbn}</p>
								<p class="mb-1 text-2xl">{title}</p>
							</div>-->

							<li
								class="entity-list-row grid w-full grid-cols-2 items-center gap-y-3 gap-x-4 py-6 text-gray-800 sm:grid-cols-3 lg:grid-cols-12 lg:gap-y-2 lg:py-4 xl:grid-cols-12"
							>
								<p data-property="isbn" class="text-xl font-medium leading-none text-gray-900 lg:col-span-3 xl:col-span-2">{isbn}</p>
								<p
									data-property="title"
									class="col-span-2 overflow-hidden whitespace-nowrap text-xl font-medium lg:col-span-5 xl:col-span-3"
								>
									{title || "Unknown Title"}
								</p>
								<p class="lg:order-4 xl:order-none xl:col-span-2">
									<span data-property="committedAt" class="badge badge-md {noteType === 'inbound' ? 'badge-green' : 'badge-red'}">
										Committed: {generateUpdatedAtString(committedAt)}
									</span>
								</p>

								<div class="col-span-2 flex items-center lg:col-span-4 lg:col-start-9 xl:col-span-4 xl:col-start-9">
									<div class="flex items-center">
										<Library class="mr-1" size={20} />
										<p data-property="warehouseName" class="entity-list-text-sm">{warehouseName}</p>
									</div>

									<a
										href={appPath("history/notes/archive", noteId)}
										class="{noteType === 'outbound'
											? 'text-red-700'
											: 'text-green-700'} mx-4 flex items-center rounded-sm border bg-gray-50 py-0.5 px-3 hover:font-semibold"
									>
										{#if noteType === "inbound"}
											<p><ArrowLeft size={16} /></p>
											<p data-property="quantity">{quantity}</p>
										{:else}
											<p data-property="quantity">{quantity}</p>
											<p><ArrowRight size={16} /></p>
										{/if}
										<p data-property="noteName" class="ml-2">{noteName}</p>
									</a>
								</div>
							</li>
						{/each}
					</ul>
				</div>
				<!-- End entity list -->
			{/if}
		</div>
		<!-- End entity list contaier -->
	</svelte:fragment>
</HistoryPage>
