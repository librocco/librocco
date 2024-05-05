<script lang="ts">
	import { fade } from "svelte/transition";
	import { type Readable } from "svelte/store";

	import { melt, createDatePicker } from "@melt-ui/svelte";
	import { Search, Library, Calendar, ChevronRight, ChevronLeft } from "lucide-svelte";
	import { map, tap, combineLatest, Observable, switchMap } from "rxjs";
	import { now, getLocalTimeZone } from "@internationalized/date";

	import { entityListView, testId, debug, wrapIter, type VolumeStock } from "@librocco/shared";
	import type { BookEntry, InventoryDatabaseInterface, NoteType } from "@librocco/db";

	import { goto } from "$app/navigation";

	import { appPath } from "$lib/paths";
	import { getDB } from "$lib/db";
	import { Page, PlaceholderBox } from "$lib/components";
	import { observableFromStore, readableFromStream } from "$lib/utils/streams";

	const {
		elements: { calendar, cell, content, field, grid, heading, nextButton, prevButton, segment, trigger },
		states: { months, headingValue, weekdays, segmentContents, value, open },
		helpers: { isDateDisabled, isDateUnavailable }
		// create a ZonedDateTime object with the current date and time
	} = createDatePicker({
		defaultValue: now(getLocalTimeZone()),
		isDateDisabled: (date) => {
			return date > now(getLocalTimeZone());
		},
		preventDeselect: true
	});

	type VolumeStockBook = VolumeStock<"book">;

	const db = getDB();
	const committedNotesListCtx = { name: "[COMMITTED_NOTES_LIST]", debug: false };
	let committedNotesListStream = new Observable<
		Map<
			string,
			(VolumeStockBook & {
				noteType: "inbound" | "outbound";
			} & {
				committedAt: string;
			})[]
		>
	>();

	db?.stream()
		.committedNotesList(committedNotesListCtx)
		.pipe((v) => (committedNotesListStream = v));

	const warehouseListCtx = { name: "[WAREHOUSE_LIST]", debug: false };

	const warehouseListStream = db?.stream().warehouseMap(warehouseListCtx);

	interface Result {
		bookList: (VolumeStockBook & BookEntry & { warehouseName: string; committedAt: string; noteType: NoteType })[];
		stats: {
			totalInboundBookCount: number;
			totalInboundCoverPrice: number;
			totalOutboundBookCount: number;
			totalOutboundCoverPrice: number;
			totalOutboundDiscountedPrice: number;
			totalInboundDiscountedPrice: number;
		};
	}
	interface CreateDisplayEntriesStore {
		(
			ctx: debug.DebugCtx,
			db: InventoryDatabaseInterface,
			committedNotesListStream: Observable<
				Map<
					string,
					(VolumeStockBook & {
						noteType: "inbound" | "outbound";
					} & {
						committedAt: string;
					})[]
				>
			>
		): {
			result: Readable<Result>;
		};
	}

	export const mapMergeBookWarehouseData =
		(ctx: debug.DebugCtx, entries: Iterable<any>) =>
		(books: Observable<Iterable<BookEntry | undefined>>): Observable<Result> =>
			combineLatest([books, warehouseListStream]).pipe(
				tap(([books, wh]) => console.log(ctx, "display_entries_store:table_data:retrieved_books", { books })),
				map(([booksData, warehouseData]) => {
					const books = wrapIter(entries)
						.zip(booksData)

						.map(([s, b = {} as BookEntry]) => {
							const warehouse = warehouseData.size ? warehouseData.get(s.warehouseId) : { displayName: "", discountPercentage: 0 };
							return {
								...s,
								...b,
								discountPercentage: warehouse.discountPercentage || 0,
								warehouseName: warehouse.displayName
							};
						})
						.array();

					return {
						bookList: books,

						stats: books.reduce(
							(acc, { quantity, noteType, discountPercentage, price = 0 }) => {
								if (noteType === "inbound") {
									return {
										...acc,
										totalInboundBookCount: (acc.totalInboundBookCount += quantity),
										totalInboundCoverPrice: (acc.totalInboundCoverPrice += quantity * price),
										totalInboundDiscountedPrice: (acc.totalInboundDiscountedPrice +=
											quantity * ((price * (100 - discountPercentage)) / 100))
									};
								}

								return {
									...acc,
									totalOutboundBookCount: (acc.totalOutboundBookCount += quantity),
									totalOutboundCoverPrice: (acc.totalOutboundCoverPrice += quantity * price),
									totalOutboundDiscountedPrice: (acc.totalOutboundDiscountedPrice +=
										quantity * ((price * (100 - discountPercentage)) / 100))
								};
							},

							{
								totalInboundBookCount: 0,
								totalInboundCoverPrice: 0,
								totalOutboundBookCount: 0,
								totalOutboundCoverPrice: 0,
								totalOutboundDiscountedPrice: 0,
								totalInboundDiscountedPrice: 0
							}
						)
					};
				}),

				tap((bookWithAllDetails) => console.log(ctx, "display_entries_store:table_data:merged_books", { bookWithAllDetails }))
			);

	export const createFilteredEntriesStore: CreateDisplayEntriesStore = (ctx, db, committedNotesListStream) => {
		const searchResStream = combineLatest([committedNotesListStream, observableFromStore(value)]).pipe(
			switchMap(([notes, date]) => {
				const entries = notes.get(date.toString().slice(0, 10)) || [];

				const isbns = entries.map((match) => match.isbn);
				console.log(entries.map((match) => match.isbn));
				console.log({ db });

				return db
					?.books()
					.stream(ctx, isbns)
					.pipe(
						tap((books) => console.log(books)),
						(bookObs) => mapMergeBookWarehouseData(ctx, entries)(bookObs)
					);
			})
		);
		return {
			result: readableFromStream(ctx, searchResStream, {} as Result)
		};
	};

	$: stores = createFilteredEntriesStore({}, db, committedNotesListStream);
	$: allEntriesList = stores.result;
</script>

<Page view="entries" loaded={true}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input on:focus={() => goto(appPath("stock"))} placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<div class="flex w-full items-center justify-between">
			<h1 class="text-2xl font-bold leading-7 text-gray-900">Entries</h1>

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
		<ul class={testId("entity-list-container")} data-view={entityListView("outbound-list")} data-loaded={true}>
			{#if !$allEntriesList || !$allEntriesList.bookList || !$allEntriesList.bookList.length}
				<!-- Start entity list placeholder -->
				<PlaceholderBox title="No Books on that date" description="Try selecting a different date." class="center-absolute" />
				<!-- End entity list placeholder -->
			{:else}
				<!-- Start entity list -->
				<div class="flex flex-row text-sm">
					<div class="badge badge-green m-2 p-2 font-bold">
						Inbound Book Count: {$allEntriesList.stats.totalInboundBookCount}
					</div>
					<div class="badge badge-green m-2 p-2 font-bold">
						Inbound Cover Price: {$allEntriesList.stats.totalInboundCoverPrice.toFixed(2)}
					</div>
					<div class="badge badge-green m-2 p-2 font-bold">
						Inbound Discounted Price : {$allEntriesList.stats.totalInboundDiscountedPrice.toFixed(2)}
					</div>
				</div>
				<div class="flex flex-row text-sm">
					<div class="badge badge-red m-2 p-2 font-bold">
						Outbound Book Count: {$allEntriesList.stats.totalOutboundBookCount}
					</div>
					<div class="badge badge-red m-2 p-2 font-bold">
						Outbound Cover Price: {$allEntriesList.stats.totalOutboundCoverPrice.toFixed(2)}
					</div>
					<div class="badge badge-red m-2 p-2 font-bold">
						Outbound Discounted Price : {$allEntriesList.stats.totalOutboundDiscountedPrice.toFixed(2)}
					</div>
				</div>
				<!-- <div>{ $allEntriesList.stats}</div>
				<div>{ $allEntriesList.stats}</div> -->
				{#each $allEntriesList.bookList as entry}
					{@const title = entry.title}
					{@const quantity = entry.quantity}
					{@const warehouseName = entry.warehouseName}
					{@const committedAt = entry.committedAt}
					{@const noteType = entry.noteType}

					<li class="entity-list-row grid grid-flow-col grid-cols-12 items-center">
						<div class="max-w-1/2 col-span-10 row-span-1 w-full xs:col-span-6 lg:row-span-2">
							<p class="entity-list-text-lg text-gray-900">{title}</p>

							<div class="flex items-center">
								<Library class="mr-1 text-gray-700" size={20} />
								<span class="entity-list-text-sm text-gray-500">{quantity} books -</span>
								<span class="entity-list-text-sm text-gray-500"> {warehouseName}</span>
							</div>
						</div>

						{#if committedAt}
							<div class="col-span-10 row-span-1 xs:col-span-6 lg:col-span-3 lg:row-span-2">
								<span class={`badge badge-sm ${noteType === "inbound" ? "badge-green" : "badge-red"}`}>Comitted At: {committedAt}</span>
							</div>
						{/if}
					</li>
				{/each}
				<!-- End entity list -->
			{/if}
		</ul>
		<!-- End entity list contaier -->
	</svelte:fragment>
</Page>

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
