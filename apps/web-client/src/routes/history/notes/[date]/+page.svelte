<script lang="ts">
	import { Library } from "lucide-svelte";
	import { now, getLocalTimeZone, type DateValue } from "@internationalized/date";

	import { entityListView, testId } from "@librocco/shared";

	import { goto } from "$app/navigation";

	import type { PageData } from "./$types";

	import { appPath } from "$lib/paths";
	import { getDB } from "$lib/db";
	import { HistoryPage, PlaceholderBox } from "$lib/components";
	import { createPastNotesStore } from "$lib/stores/inventory/history_entries";
	import { browser } from "$app/environment";
	import { generateUpdatedAtString } from "$lib/utils/time";
	import CalendarPicker from "$lib/components/CalendarPicker.svelte";

	export let data: PageData;

	const isEqualDateValue = (a?: DateValue, b?: DateValue): boolean => {
		if (!a || !b) return false;
		return a.toString().slice(0, 10) === b.toString().slice(0, 10);
	};

	// #region date picker
	const defaultDateValue = data.dateValue;
	const onDateValueChange = ({ next }) => {
		// Redirect only in browser, if data value is different then the one in route param
		if (browser && !isEqualDateValue(data.dateValue, next)) {
			// The replaceState part allows us to have the date as part of the route (for sharing/reaload),
			// whilst keeping the date changes a single history entry (allowing for quick 'back' navigation)
			goto(appPath("history/notes", next.toString().slice(0, 10)), { replaceState: true });
		}
		return next;
	};
	const isDateDisabled = (date: DateValue) => {
		return date > now(getLocalTimeZone());
	};
	// #endregion date picker

	const { db } = getDB();

	const pastNotesCtx = { name: "[NOTES_BY_DAY]", debug: false };
	$: notes = createPastNotesStore(pastNotesCtx, db, data.date);
</script>

<HistoryPage view="history/notes">
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
