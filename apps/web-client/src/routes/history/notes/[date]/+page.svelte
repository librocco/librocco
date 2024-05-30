<script lang="ts">
	import { fade } from "svelte/transition";

	import { melt, createDatePicker } from "@melt-ui/svelte";
	import { Library, Calendar, ChevronRight, ChevronLeft } from "lucide-svelte";
	import { now, getLocalTimeZone, fromDate, type DateValue } from "@internationalized/date";

	import { entityListView, testId } from "@librocco/shared";

	import { goto } from "$app/navigation";

	import type { PageData } from "./$types";

	import { appPath } from "$lib/paths";
	import { getDB } from "$lib/db";
	import { HistoryPage, PlaceholderBox } from "$lib/components";
	import { createPastNotesStore } from "$lib/stores/inventory/history_entries";
	import { browser } from "$app/environment";
	import { generateUpdatedAtString } from "$lib/utils/time";

	export let data: PageData;

	const isEqualDateValue = (a?: DateValue, b?: DateValue): boolean => {
		if (!a || !b) return false;
		return a.toString().slice(0, 10) === b.toString().slice(0, 10);
	};

	const {
		elements: { calendar, cell, content, field, grid, heading, nextButton, prevButton, segment, trigger },
		states: { months, headingValue, weekdays, segmentContents, open, value },
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
				goto(appPath("history/notes", next.toString().slice(0, 10)), { replaceState: true });
			}
			return next;
		},
		preventDeselect: true
	});

	const db = getDB();

	const pastNotesCtx = { name: "[NOTES_BY_DAY]", debug: false };
	$: notes = createPastNotesStore(pastNotesCtx, db, data.date);
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
		<ul class={testId("entity-list-container")} data-view={entityListView("inbound-list")} data-loaded={true}>
			{#if !$notes.length}
				<!-- Start entity list placeholder -->
				<PlaceholderBox title="No notes found" description="No notes seem to have been committed on that date" class="center-absolute" />
				<!-- End entity list placeholder -->
			{:else}
				<!-- Start entity list -->
				{#each $notes as note}
					{@const displayName = `${note.warehouseName} / ${note.displayName}`}
					{@const totalBooks = note.books}
					{@const href = appPath("history/notes", note.id)}

					<div class="group entity-list-row">
						<div class="block w-full">
							<a {href} class="entity-list-text-lg mb-2 block text-gray-900 hover:underline focus:underline">{displayName}</a>

							<div class="grid w-full grid-cols-4 items-start gap-2 lg:grid-cols-8">
								<div class="order-1 col-span-2 flex gap-x-0.5 lg:col-span-1">
									<Library class="mr-1 text-gray-700" size={24} />
									<span class="entity-list-text-sm text-gray-500">{totalBooks} books</span>
								</div>

								<p class="order-2 col-span-2 text-gray-500 lg:order-3">
									Total cover price: <span class="text-gray-700">{note.totalCoverPrice.toFixed(2)}</span>
								</p>

								<p class="order-3 col-span-2 lg:order-2">
									<span class="badge badge-md {note.noteType === 'inbound' ? 'badge-green' : 'badge-red'}">
										Committed: {generateUpdatedAtString(note.date, "time-only")}
									</span>
								</p>

								<p class="order-4 col-span-2 text-gray-500">
									Total discounted price: <span class="text-gray-700">{note.totalDiscountedPrice.toFixed(2)}</span>
								</p>
							</div>
						</div>
					</div>
				{/each}
				<!-- End entity list -->
			{/if}
		</ul>
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