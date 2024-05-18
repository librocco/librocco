<script lang="ts">
	import { writable } from "svelte/store";

	import { QrCode, Loader2 as Loader, Search } from "lucide-svelte";

	import type { PageData } from "./$types";

	import {
		Breadcrumbs,
		Page,
		PlaceholderBox,
		createBreadcrumbs,
		TextEditable,
		ExtensionAvailabilityToast,
		StockTable,
		StockBookRow
	} from "$lib/components";
	import type { InventoryTableData } from "$lib/components/Tables/types";

	import { createNoteStores } from "$lib/stores/proto";

	import { createIntersectionObserver, createTable } from "$lib/actions";

	import { generateUpdatedAtString } from "$lib/utils/time";

	import { goto } from "$app/navigation";
	import { appPath } from "$lib/paths";

	export let data: PageData;

	$: loading = !data;
	$: note = data.note;

	$: noteStores = createNoteStores(note);

	$: displayName = noteStores.displayName;
	$: updatedAt = noteStores.updatedAt;
	$: entries = noteStores.entries;

	// #region infinite-scroll
	let maxResults = 20;
	// Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	const seeMore = () => (maxResults += 20);
	// We're using in intersection observer to create an infinite scroll effect
	const scroll = createIntersectionObserver(seeMore);
	// #endregion infinite-scroll

	// #region table
	const tableOptions = writable<{ data: InventoryTableData[] }>({
		data: $entries
			?.slice(0, maxResults)
			// TEMP: remove this when the db is updated
			.map((entry) => ({ __kind: "book", ...entry }))
	});

	const table = createTable(tableOptions);

	$: tableOptions.set({
		data: ($entries as InventoryTableData[])?.slice(0, maxResults)
	});
	// #endregion table

	$: breadcrumbs = note?._id ? createBreadcrumbs("outbound", { id: note._id, displayName: $displayName }) : [];
</script>

<Page view="outbound-note" loaded={!loading}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input on:focus={() => goto(appPath("stock"))} placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<Breadcrumbs class="mb-3" links={breadcrumbs} />
		<div class="flex w-full items-center justify-between">
			<div class="flex max-w-md flex-col">
				<TextEditable
					name="title"
					textEl="h1"
					textClassName="text-2xl font-bold leading-7 text-gray-900"
					placeholder="Note"
					disabled
					bind:value={$displayName}
				/>

				<div class="w-fit">
					{#if $updatedAt}
						<span class="badge badge-md badge-green">Last updated: {generateUpdatedAtString($updatedAt)}</span>
					{/if}
				</div>
			</div>

			<div class="ml-auto flex items-center gap-x-2">
				<button class="button button-green">Export CSV</button>
			</div>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		{#if loading}
			<div class="center-absolute">
				<Loader strokeWidth={0.6} class="animate-[spin_0.5s_linear_infinite] text-teal-500 duration-300" size={70} />
			</div>
		{:else if !$entries.length}
			<PlaceholderBox title="Scan to add books" description="Plugin your barcode scanner and pull the trigger" class="center-absolute">
				<QrCode slot="icon" let:iconProps {...iconProps} />
			</PlaceholderBox>
		{:else}
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-auto" style="scrollbar-width: thin">
				<!-- This div allows us to scroll (and use intersecion observer), but prevents table rows from stretching to fill the entire height of the container -->
				<div>
					<StockTable {table}>
						<tr slot="row" let:row let:rowIx>
							<StockBookRow {row} {rowIx} />
						</tr>
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
