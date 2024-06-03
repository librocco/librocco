<script lang="ts">
	import { fade } from "svelte/transition";
	import { melt, createDatePicker } from "@melt-ui/svelte";
	import { Library, Calendar, ChevronRight, ChevronLeft, ArrowLeft, ArrowRight } from "lucide-svelte";
	import { now, getLocalTimeZone, type DateValue } from "@internationalized/date";

	import { entityListView, testId } from "@librocco/shared";

	import { goto } from "$app/navigation";
	import { browser } from "$app/environment";

	import type { PageData } from "./$types";

	import { HistoryPage, PlaceholderBox } from "$lib/components";

	import { createDailySummaryStore } from "$lib/stores/inventory/history_entries";

	import { getDB } from "$lib/db";

	import { appPath } from "$lib/paths";
	import { generateUpdatedAtString } from "$lib/utils/time";

	export let data: PageData;

	const isEqualDateValue = (a?: DateValue, b?: DateValue): boolean => {
		if (!a || !b) return false;
		return a.toString().slice(0, 10) === b.toString().slice(0, 10);
	};

	const {
		elements: { calendar, cell, content, field, grid, heading, nextButton, prevButton, segment, trigger },
		states: { months, headingValue, weekdays, segmentContents, open },
		helpers: { isDateDisabled, isDateUnavailable }
		// create a ZonedDateTime object with the current date and time
	} = createDatePicker({
		// 'date' param should always be defined as the route doesn't render without the date param
		defaultValue: data.dateValue,
		isDateDisabled: (date) => {
			return date > now(getLocalTimeZone());
		},
		onValueChange: ({ next }) => {
			// Redirect only in browser, if data value is different then the one in route param
			if (browser && !isEqualDateValue(data.dateValue, next)) {
				// The replaceState part allows us to have the date as part of the route (for sharing/reaload),
				// whilst keeping the date changes a single history entry (allowing for quick 'back' navigation)
				goto(appPath("history/date", next.toString().slice(0, 10)), { replaceState: true });
			}
			return next;
		},
		preventDeselect: true
	});

	const { db, status } = getDB();
	if (!status) goto(appPath("settings"));

	const dailySummaryCtx = { name: "[DAILY_SUMMARY]", debug: false };
	$: dailySummary = createDailySummaryStore(dailySummaryCtx, db, data.date);
</script>

<HistoryPage view="history/date">
	<svelte:fragment slot="heading">
		<div class="flex w-full justify-between">
			<h1 class="text-2xl font-bold leading-7 text-gray-900">History</h1>

			<section class="flex w-full flex-col items-center gap-3">
				<div>
					<div
						class="mt-1.5 flex w-full min-w-[200px] items-center rounded-lg border border-gray-400 bg-gray-50 p-1.5 text-gray-600"
						use:melt={$field}
					>
						{#each $segmentContents as seg}
							<div class="px-0.5" use:melt={$segment(seg.part)}>
								{seg.value}
							</div>
						{/each}
						<div class="ml-4 flex w-full items-center justify-end">
							<button class="rounded-md p-1 text-gray-600 transition-all" use:melt={$trigger}>
								<Calendar size={20} />
							</button>
						</div>
					</div>
				</div>
				{#if $open}
					<div class="z-10 min-w-[320px] rounded-lg bg-white shadow-sm" transition:fade={{ duration: 100 }} use:melt={$content}>
						<div class="w-full rounded-lg bg-white p-3 text-gray-600 shadow-sm" use:melt={$calendar}>
							<header class="flex items-center justify-between pb-2">
								<button class="rounded-lg p-1 transition-all" use:melt={$prevButton}>
									<ChevronLeft size={24} />
								</button>
								<div class="flex items-center gap-6" use:melt={$heading}>
									{$headingValue}
								</div>
								<button class="rounded-lg p-1 transition-all" use:melt={$nextButton}>
									<ChevronRight size={24} />
								</button>
							</header>
							<div>
								{#each $months as month}
									<table class="w-full" use:melt={$grid}>
										<thead aria-hidden="true">
											<tr>
												{#each $weekdays as day}
													<th class="text-sm font-semibold">
														<div class="flex h-6 w-6 items-center justify-center p-4">
															{day}
														</div>
													</th>
												{/each}
											</tr>
										</thead>
										<tbody>
											{#each month.weeks as weekDates}
												<tr>
													{#each weekDates as date}
														<td role="gridcell" aria-disabled={$isDateDisabled(date) || $isDateUnavailable(date)}>
															<div use:melt={$cell(date, month.value)}>
																{date.day}
															</div>
														</td>
													{/each}
												</tr>
											{/each}
										</tbody>
									</table>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</section>
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

				<div class="flex flex-row text-sm">
					<div class="badge badge-green m-2 p-2 font-bold">
						Inbound Book Count: {$dailySummary.stats.totalInboundBookCount}
					</div>
					<div class="badge badge-green m-2 p-2 font-bold">
						Inbound Cover Price: {$dailySummary.stats.totalInboundCoverPrice.toFixed(2)}
					</div>
					<div class="badge badge-green m-2 p-2 font-bold">
						Inbound Discounted Price : {$dailySummary.stats.totalInboundDiscountedPrice.toFixed(2)}
					</div>
				</div>

				<div class="flex flex-row text-sm">
					<div class="badge badge-red m-2 p-2 font-bold">
						Outbound Book Count: {$dailySummary.stats.totalOutboundBookCount}
					</div>
					<div class="badge badge-red m-2 p-2 font-bold">
						Outbound Cover Price: {$dailySummary.stats.totalOutboundCoverPrice.toFixed(2)}
					</div>
					<div class="badge badge-red m-2 p-2 font-bold">
						Outbound Discounted Price : {$dailySummary.stats.totalOutboundDiscountedPrice.toFixed(2)}
					</div>
				</div>

				<h2 class="px-4 py-4 pt-8 text-xl font-semibold">Transactions</h2>

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
							class="entity-list-row grid w-full w-full grid-cols-2 items-center gap-y-3 gap-x-4 py-6 text-gray-800 sm:grid-cols-3 lg:grid-cols-12 lg:gap-y-2 lg:py-4 xl:grid-cols-12"
						>
							<p class="text-xl font-medium leading-none text-gray-900 lg:col-span-3 xl:col-span-2">{isbn}</p>
							<p class="col-span-2 overflow-hidden whitespace-nowrap text-xl font-medium lg:col-span-5 xl:col-span-3">
								{title || ""}
							</p>
							<p class="lg:order-4 xl:order-none xl:col-span-2">
								<span class="badge badge-md {noteType === 'inbound' ? 'badge-green' : 'badge-red'}">
									Committed: {generateUpdatedAtString(committedAt, "time-only")}
								</span>
							</p>

							<div class="col-span-2 flex items-center lg:col-span-4 lg:col-start-9 xl:col-span-4 xl:col-start-9">
								<div class="flex items-center">
									<Library class="mr-1" size={20} />
									<p class="entity-list-text-sm">{warehouseName}</p>
								</div>

								<a
									href={appPath("history/notes", noteId)}
									class="{noteType === 'outbound'
										? 'text-red-700'
										: 'text-green-700'} mx-4 flex items-center rounded-sm border bg-gray-50 py-0.5 px-3 hover:font-semibold"
								>
									{#if noteType === "inbound"}
										<p><ArrowLeft size={16} /></p>
										<p>{quantity}</p>
									{:else}
										<p>{quantity}</p>
										<p><ArrowRight size={16} /></p>
									{/if}
									<p class="ml-2">{noteName}</p>
								</a>
							</div>
						</li>
					{/each}
				</ul>
				<!-- End entity list -->
			{/if}
		</div>
		<!-- End entity list contaier -->
	</svelte:fragment>
</HistoryPage>

<style lang="postcss">
	[data-melt-calendar-prevbutton][data-disabled] {
		@apply pointer-events-none rounded-lg p-1 opacity-40;
	}

	[data-melt-calendar-nextbutton][data-disabled] {
		@apply pointer-events-none rounded-lg p-1 opacity-40;
	}

	[data-melt-calendar-heading] {
		@apply font-semibold;
	}

	[data-melt-calendar-grid] {
		@apply w-full;
	}

	[data-melt-calendar-cell] {
		@apply flex h-6 w-6 cursor-pointer select-none items-center justify-center rounded-lg  p-4;
	}

	[data-melt-calendar-cell][data-disabled] {
		@apply pointer-events-none opacity-40;
	}
	[data-melt-calendar-cell][data-unavailable] {
		@apply pointer-events-none text-red-400 line-through;
	}

	[data-melt-calendar-cell][data-selected] {
		@apply bg-teal-400 text-base;
	}

	[data-melt-calendar-cell][data-outside-visible-months] {
		@apply pointer-events-none cursor-default opacity-40;
	}

	[data-melt-calendar-cell][data-outside-month] {
		@apply pointer-events-none cursor-default opacity-0;
	}
</style>
