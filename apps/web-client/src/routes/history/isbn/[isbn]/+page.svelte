<script lang="ts">
	import { Search, Library, ArrowLeft, ArrowRight } from "lucide-svelte";
	import { createDropdownMenu } from "@melt-ui/svelte";

	import { page } from "$app/stores";

	import type { BookEntry, SearchIndex } from "@librocco/db";
	import { entityListView, testId } from "@librocco/shared";

	import { appPath } from "$lib/paths";

	import { Page, PlaceholderBox } from "$lib/components";
	import { getDB } from "$lib/db";

	import { createBookHistoryStores } from "$lib/stores/inventory/history_entries";
	import { createFilteredEntriesStore } from "$lib/stores/proto/search";

	import { generateUpdatedAtString } from "$lib/utils/time";

	const db = getDB();

	$: isbn = $page.params.isbn;

	const dailySummaryCtx = { name: "[BOOK_HISTORY]", debug: true };
	$: stores = createBookHistoryStores(dailySummaryCtx, db, isbn);

	$: bookData = stores.bookData;
	$: transactions = stores.transactions;

	const createMetaString = ({ authors, year, publisher }: Partial<Pick<BookEntry, "authors" | "year" | "publisher">>) =>
		[authors, year, publisher].filter(Boolean).join(", ");

	// #region search

	// Create a search index for books in the db. Each time the books change, we recreate the index.
	// This is more/less inexpensive (around 2sec), considering it runs in the background.
	let index: SearchIndex | undefined;
	db?.books()
		.streamSearchIndex()
		.subscribe((ix) => (index = ix));

	$: searchStores = createFilteredEntriesStore({ name: "[SEARCH]", debug: false }, db, index);

	$: search = searchStores.search;
	$: entries = searchStores.entries;

	let searchContainer: HTMLElement | null = null;

	const {
		states: { open }
	} = createDropdownMenu({});

	const searchDropdown = (node?: HTMLElement, searchContainer?: HTMLElement) => {
		if (!node || !searchContainer) return;

		const { bottom, left, width } = searchContainer.getBoundingClientRect();
		const style = `position: fixed; top: ${bottom + 32}px; left: ${left}px; width: ${width}px; bottom: 32px; overflow-hidden`;
		node.setAttribute("style", style);

		return {
			destroy() {}
		};
	};
	// #endregion search
</script>

<Page view="history" loaded={true}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input
			bind:this={searchContainer}
			on:focus={() => ($open = true)}
			on:blur={() => ($open = false)}
			on:click={() => ($open = true)}
			bind:value={$search}
			placeholder="Search"
			{...inputProps}
		/>
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<div class="w-full text-gray-700">
			<!--text-2xl font-bold leading-7 text-gray-900-->
			<h2 class="mt-2 mb-1 text-sm font-semibold leading-none text-gray-900">{isbn}</h2>
			<p class="mb-1 text-2xl">
				{#if $bookData.title}<span class="font-bold">{$bookData.title}, </span>{/if}
				{#if $bookData.authors}<span>{$bookData.authors}</span>{/if}
			</p>
			<p>{`${$bookData.year}, ` || ""}{$bookData.publisher || ""}</p>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<!-- Start entity list contaier -->

		<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
		<div class={testId("entity-list-container")} data-view={entityListView("outbound-list")} data-loaded={true}>
			{#if !$transactions?.length}
				<!-- Start entity list placeholder -->
				<PlaceholderBox
					title="No transactions found"
					description="There seems to be no record for transactions of the given isbn volumes going in or out"
					class="center-absolute"
				/>
				<!-- End entity list placeholder -->
			{:else}
				<ul class="grid w-full grid-cols-12 divide-y">
					{#each $transactions as txn}
						{@const quantity = txn.quantity}
						{@const noteId = txn.noteId}
						{@const noteName = txn.noteDisplayName}
						{@const noteType = txn.noteType}
						{@const committedAt = txn.date}
						{@const warehouseName = txn.warehouseName}

						<li class="col-span-12 grid grid-cols-12">
							<div class="entity-list-row col-span-8 grid grid-cols-8 items-center text-gray-800">
								<p class="col-span-2">
									{generateUpdatedAtString(committedAt)}
								</p>

								<div class="col-span-2 flex items-center">
									<Library class="mr-1" size={20} />
									<p class="entity-list-text-sm">{warehouseName}</p>
								</div>

								<a href="{appPath('history')}notes/{noteId}" class="col-span-4 flex items-center">
									<div class="{noteType === 'outbound' ? 'badge-red' : 'badge-green'} mx-4 flex items-center rounded-sm px-3">
										{#if noteType === "inbound"}
											<p><ArrowLeft size={16} /></p>
											<p>{quantity}</p>
										{:else}
											<p>{quantity}</p>
											<p><ArrowRight size={16} /></p>
										{/if}
									</div>

									<p>{noteName}</p>
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
</Page>

{#if $open && $entries?.length}
	<div use:searchDropdown={searchContainer}>
		<ul class="max-h-[100%] w-full divide-y overflow-y-auto rounded border bg-white shadow-2xl">
			{#each $entries as entry}
				{@const { isbn, title, authors, year, publisher } = entry}

				<li class="w-full">
					<a href="{appPath('history')}isbn/{isbn}" class="block w-full px-4 py-3">
						<p class="mt-2 text-sm font-semibold leading-none text-gray-900">{isbn}</p>
						<p class="text-xl font-medium">{title}</p>
						<p>{createMetaString({ authors, year, publisher })}</p>
					</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}

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
