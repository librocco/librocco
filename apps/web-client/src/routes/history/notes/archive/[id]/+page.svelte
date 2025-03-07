<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { writable } from "svelte/store";
	import { invalidate } from "$app/navigation";

	import { QrCode, Loader2 as Loader, Search } from "lucide-svelte";

	import type { PageData } from "./$types";

	import { Page, PlaceholderBox, ExtensionAvailabilityToast, StockTable, StockBookRow } from "$lib/components";
	import type { InventoryTableData } from "$lib/components/Tables/types";

	import { createIntersectionObserver, createTable } from "$lib/actions";

	import { generateUpdatedAtString } from "$lib/utils/time";

	import { racefreeGoto } from "$lib/utils/navigation";
	import { appPath } from "$lib/paths";
	import { createOutboundNote, getNoteIdSeq } from "$lib/db/cr-sqlite/note";

	export let data: PageData;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		// Here we only care about updates to warehouses (displayName)
		// as the rest of the data is immutable at this point (archived)
		disposer = rx.onRange(["warehouse"], () => invalidate("note:books"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	$: goto = racefreeGoto(disposer);

	$: db = data?.dbCtx?.db;

	// We display loading state before navigation (in case of creating new note/warehouse)
	// and reset the loading state when the data changes (should always be truthy -> thus, loading false).
	$: loading = !data;

	$: displayName = data.displayName;
	$: updatedAt = data.updatedAt;

	$: bookEntries = data.entries?.map((e) => ({ __kind: "book", ...e })) as InventoryTableData[];
	$: customItemEntries = data.customItems?.map((e) => ({ __kind: "custom", ...e })) as InventoryTableData[];
	$: entries = bookEntries.concat(customItemEntries);

	$: plugins = data.plugins;

	// #region infinite-scroll
	let maxResults = 20;
	// Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	const seeMore = () => (maxResults += 20);
	// We're using in intersection observer to create an infinite scroll effect
	const scroll = createIntersectionObserver(seeMore);
	// #endregion infinite-scroll

	// #region table
	const tableOptions = writable({ data: entries?.slice(0, maxResults) });
	const table = createTable(tableOptions);
	$: tableOptions.set({ data: entries?.slice(0, maxResults) });
	// #endregion table

	/**
	 * Handle create note is an `on:click` handler used to create a new outbound note
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateOutboundNote = async () => {
		const id = await getNoteIdSeq(db);
		await createOutboundNote(db, id);
		await goto(appPath("outbound", id));
	};
</script>

<Page {handleCreateOutboundNote} view="outbound-note" loaded={!loading}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input on:focus={() => goto(appPath("stock"))} placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<div class="flex w-full items-center justify-between">
			<div class="flex max-w-md flex-col">
				<div class="relative block w-full p-2">
					<div class="flex flex-row items-center gap-x-2 text-gray-400">
						<h1 class="text-2xl font-bold leading-7 text-gray-900">{displayName}</h1>
					</div>
				</div>

				<div class="w-fit">
					{#if updatedAt}
						<span class="badge badge-md badge-green">Committed at: {generateUpdatedAtString(updatedAt)}</span>
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
		{:else if !entries.length}
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
				{#if entries?.length > maxResults}
					<div use:scroll.trigger />
				{/if}
			</div>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast {plugins} />
	</svelte:fragment>
</Page>
