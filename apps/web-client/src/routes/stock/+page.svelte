<script lang="ts">
	import { tick } from "svelte";
	import { writable } from "svelte/store";
	import { fade, fly } from "svelte/transition";

	import { createDialog, melt } from "@melt-ui/svelte";
	import { Search, FileEdit, X, Loader2 as Loader, Printer, MoreVertical } from "lucide-svelte";

	import type { SearchIndex, BookEntry } from "@librocco/db";

	import { ExtensionAvailabilityToast, PopoverWrapper, StockTable, StockBookRow, TooltipWrapper } from "$lib/components";
	import { BookForm, bookSchema, type BookFormOptions } from "$lib/forms";

	import { createFilteredEntriesStore } from "$lib/stores/proto/search";
	import { createExtensionAvailabilityStore } from "$lib/stores";

	import { Page, PlaceholderBox } from "$lib/components";
	import { createIntersectionObserver, createTable } from "$lib/actions";
	import { readableFromStream } from "$lib/utils/streams";

	import { getDB } from "$lib/db";
	import { testId } from "@librocco/shared";

	const db = getDB();

	const publisherListCtx = { name: "[PUBLISHER_LIST::INBOUND]", debug: false };
	const publisherList = readableFromStream(publisherListCtx, db?.books().streamPublishers(publisherListCtx), []);

	// Create a search index for books in the db. Each time the books change, we recreate the index.
	// This is more/less inexpensive (around 2sec), considering it runs in the background.
	let index: SearchIndex | undefined;
	db?.books()
		.streamSearchIndex()
		.subscribe((ix) => (index = ix));

	$: stores = createFilteredEntriesStore({ name: "[SEARCH]", debug: false }, db, index);

	$: search = stores.search;
	$: entries = stores.entries;

	let maxResults = 20;
	const resetMaxResults = () => (maxResults = 20);
	// Reset max results when search string changes
	$: $search.length && resetMaxResults();
	// Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	const seeMore = () => (maxResults += 20);
	// We're using in intersection observer to create an infinite scroll effect
	const scroll = createIntersectionObserver(seeMore);

	const tableOptions = writable({
		data: $entries
	});
	const table = createTable(tableOptions);
	$: tableOptions.set({ data: $entries?.slice(0, maxResults) });

	let searchField: HTMLInputElement;
	$: tick().then(() => searchField?.focus());

	const autofocus = (node?: HTMLInputElement) => node?.focus();

	// #region book-form
	let bookFormData = null;

	const onUpdated: BookFormOptions["onUpdated"] = async ({ form }) => {
		/**
		 * This is a quick fix for `form.data` having all optional properties
		 *
		 * Unforuntately, Zod will not infer the correct `data` type from our schema unless we configure `strictNullChecks: true` in our TS config.
		 * Doing so however raises a mountain of "... potentially undefined" type errors throughout the codebase. It will take a significant amount of work
		 * to fix these properly.
		 *
		 * It is still safe to assume that the required properties of BookEntry are there, as the relative form controls are required
		 */
		const data = form?.data as BookEntry;

		try {
			await db.books().upsert([data]);

			bookFormData = null;
			open.set(false);
		} catch (err) {
			// toastError(`Error: ${err.message}`);
		}
	};

	$: bookDataExtensionAvailable = createExtensionAvailabilityStore(db);
	// #endregion book-form

	const {
		elements: { trigger, overlay, content, title, description, close, portalled },
		states: { open }
	} = createDialog({
		forceVisible: true
	});
</script>

<Page view="stock" loaded={true}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input data-testid={testId("search-input")} use:autofocus bind:value={$search} placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<h1 class="text-2xl font-bold leading-7 text-gray-900">Search</h1>
	</svelte:fragment>

	<svelte:fragment slot="main">
		{#if !$search.length}
			<PlaceholderBox title="Search for stock" description="Get started by searching by title, author, ISBN" class="center-absolute">
				<Search slot="icon" let:iconProps {...iconProps} />
			</PlaceholderBox>
		{:else if !$entries?.length}
			<!-- Using await :then trick we're displaying the loading state for 1s, after which we show no-results message -->
			<!-- The waiting state is here so as to not display the no results to quickly (in case of initial search, being slightly slower) -->
			{#await new Promise((r) => setTimeout(r, 1000))}
				<div class="center-absolute">
					<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
				</div>
			{:then}
				<PlaceholderBox title="No results" description="Search found no results" class="center-absolute">
					<Search slot="icon" let:iconProps {...iconProps} />
				</PlaceholderBox>
			{/await}
		{:else}
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<!-- This div allows us to scroll (and use intersecion observer), but prevents table rows from stretching to fill the entire height of the container -->
				<div>
					<StockTable {table}>
						<svelte:fragment slot="row" let:row let:rowIx>
							<TooltipWrapper
								options={{
									positioning: {
										placement: "top-start"
									},
									openDelay: 0,
									closeDelay: 0,
									closeOnPointerDown: true,
									forceVisible: true,
									disableHoverableContent: true
								}}
								let:trigger={tooltipTrigger}
							>
								<tr {...tooltipTrigger} use:tooltipTrigger.action use:table.tableRow={{ position: rowIx }}>
									<StockBookRow {row} {rowIx}>
										<div slot="row-actions">
											<PopoverWrapper
												options={{
													forceVisible: true,
													positioning: {
														placement: "left"
													}
												}}
												let:trigger
											>
												<button
													data-testid={testId("popover-control")}
													{...trigger}
													use:trigger.action
													class="rounded p-3 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
												>
													<span class="sr-only">Edit row {rowIx}</span>
													<span class="aria-hidden">
														<MoreVertical />
													</span>
												</button>

												<div slot="popover-content" data-testid={testId("popover-container")} class="rounded bg-gray-900">
													<button
														use:melt={$trigger}
														on:m-click={() => (bookFormData = row)}
														class="rounded p-3 text-gray-500 hover:text-gray-900"
													>
														<span class="sr-only">Edit row {rowIx}</span>
														<span class="aria-hidden">
															<FileEdit />
														</span>
													</button>

													<button
														class="rounded p-3 text-white hover:text-teal-500 focus:outline-teal-500 focus:ring-0"
														data-testid={testId("print-book-label")}
														on:click={() => db.printer().label().print(row)}
													>
														<span class="sr-only">Print book label {rowIx}</span>
														<span class="aria-hidden">
															<Printer />
														</span>
													</button>
												</div>
											</PopoverWrapper>
										</div>
									</StockBookRow>
								</tr>

								<p slot="tooltip-content" class="px-4 py-1 text-white">{row.warehouseName}</p>
							</TooltipWrapper>
						</svelte:fragment>
					</StockTable>
				</div>

				<!-- Trigger for the infinite scroll intersection observer -->
				{#if $entries?.length > maxResults}
					<div use:scroll.trigger />
				{/if}
			</div>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast />
	</svelte:fragment>
</Page>

<div use:melt={$portalled}>
	{#if $open}
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-black/50" transition:fade|global={{ duration: 150 }}>
			<div
				use:melt={$content}
				class="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col gap-y-4 overflow-y-auto bg-white
				shadow-lg focus:outline-none"
				transition:fly|global={{
					x: 350,
					duration: 300,
					opacity: 1
				}}
			>
				<div class="flex w-full flex-row justify-between bg-gray-50 px-6 py-4">
					<div>
						<h2 use:melt={$title} class="mb-0 text-lg font-medium text-black">Edit book details</h2>
						<p use:melt={$description} class="mb-5 mt-2 leading-normal text-zinc-600">Manually edit book details</p>
					</div>
					<button use:melt={$close} aria-label="Close" class="self-start rounded p-3 text-gray-500 hover:text-gray-900">
						<X class="square-4" />
					</button>
				</div>
				<div class="px-6">
					<BookForm
						data={bookFormData}
						publisherList={$publisherList}
						options={{
							SPA: true,
							dataType: "json",
							validators: bookSchema,
							validationMethod: "submit-only",
							onUpdated
						}}
						onCancel={() => open.set(false)}
						onFetch={async (isbn, form) => {
							const result = await db.plugin("book-fetcher").fetchBookData([isbn]);

							const [bookData] = result;
							if (!bookData) {
								return;
							}

							form.update((data) => ({ ...data, ...bookData }));
							// TODO: handle loading and errors
						}}
						isExtensionAvailable={$bookDataExtensionAvailable}
					/>
				</div>
			</div>
		</div>
	{/if}
</div>
