<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { Library } from "lucide-svelte";
	import { now, getLocalTimeZone, type DateValue } from "@internationalized/date";
	import { browser } from "$app/environment";
	import { invalidate } from "$app/navigation";

	import { entityListView, testId } from "@librocco/shared";

	import type { PageData } from "./$types";

	import { createOutboundNote, getNoteIdSeq } from "$lib/db/cr-sqlite/note";
	import CalendarPicker from "$lib/components/CalendarPicker.svelte";
	import { HistoryPage, PlaceholderBox } from "$lib/components";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { racefreeGoto } from "$lib/utils/navigation";

	import { appPath } from "$lib/paths";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		// Reload when note/warehouse changes (warehouse name/discount, note committed status)
		disposer = rx.onRange(["note", "warehouse"], () => invalidate("history:notes"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	$: goto = racefreeGoto(disposer);

	const isEqualDateValue = (a?: DateValue, b?: DateValue): boolean => {
		if (!a || !b) return false;
		return a.toString().slice(0, 10) === b.toString().slice(0, 10);
	};

	// #region date picker
	const defaultDateValue = data.dateValue;
	const onDateValueChange = ({ next }) => {
		if (!next) return;
		// Redirect only in browser, if data value is different then the one in route param
		if (browser && !isEqualDateValue(data.dateValue, next)) {
			// The replaceState part allows us to have the date as part of the route (for sharing/reaload),
			// whilst keeping the date changes a single history entry (allowing for quick 'back' navigation)
			goto(appPath("history/notes/date", next.toString().slice(0, 10)), { replaceState: true });
		}
		return next;
	};
	const isDateDisabled = (date: DateValue) => {
		return date > now(getLocalTimeZone());
	};
	// #endregion date picker

	$: ({
		notes,
		dbCtx: { db }
	} = data);

	/**
	 * Handle create note is an `on:click` handler used to create a new outbound note
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateOutboundNote = async () => {
		const id = await getNoteIdSeq(db);
		await createOutboundNote(db, id);
		await goto(appPath("outbound", id));
	};

	const handleSearch = async () => await goto(appPath("stock"));
</script>

<HistoryPage view="history/notes" {handleSearch} {handleCreateOutboundNote}>
	<svelte:fragment slot="heading">
		<div class="flex w-full justify-between">
			<div class="flex w-full flex-col items-center gap-3">
				<CalendarPicker onValueChange={onDateValueChange} defaultValue={defaultDateValue} {isDateDisabled} />
			</div>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<!-- Start entity list contaier -->

		<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
		<ul class={testId("entity-list-container")} data-view={entityListView("history/notes")}>
			{#if !notes.length}
				<!-- Start entity list placeholder -->
				<PlaceholderBox title="No notes found" description="No notes seem to have been committed on that date" class="center-absolute" />
				<!-- End entity list placeholder -->
			{:else}
				<!-- Start entity list -->
				{#each notes as note}
					{@const displayName = `${note.warehouseName} / ${note.displayName}`}
					{@const totalBooks = note.totalBooks}
					{@const href = appPath("history/notes/archive", note.id)}

					<div class="entity-list-row group">
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
										Committed: {generateUpdatedAtString(note.committedAt, "time-only")}
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
		@apply flex h-6 w-6 cursor-pointer select-none items-center justify-center rounded-lg p-4;
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
