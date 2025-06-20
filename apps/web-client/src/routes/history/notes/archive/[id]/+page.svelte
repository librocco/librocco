<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { writable } from "svelte/store";
	import { invalidate } from "$app/navigation";

	import QrCode from "$lucide/qr-code";

	import type { PageData } from "./$types";

	import { PlaceholderBox, StockTable, StockBookRow } from "$lib/components";
	import { HistoryPage } from "$lib/controllers";
	import type { InventoryTableData } from "$lib/components/Tables/types";

	import { createIntersectionObserver, createTable } from "$lib/actions";

	import { generateUpdatedAtString } from "$lib/utils/time";

	import { racefreeGoto } from "$lib/utils/navigation";
	import { appPath } from "$lib/paths";

	import LL from "@librocco/shared/i18n-svelte";
	import { download, generateCsv, mkConfig } from "export-to-csv";
	import type { PastTransactionItem } from "$lib/db/cr-sqlite/types";

	export let data: PageData;

	$: ({ plugins, displayName, updatedAt } = data);
	$: db = data.dbCtx?.db;

	$: t = $LL.history_page.notes_tab.archive;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// Here we only care about updates to warehouses (displayName)
		// as the rest of the data is immutable at this point (archived)
		disposer = data.dbCtx?.rx?.onRange(["warehouse"], () => invalidate("note:books"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});
	$: goto = racefreeGoto(disposer);

	// We display loading state before navigation (in case of creating new note/warehouse)
	// and reset the loading state when the data changes (should always be truthy -> thus, loading false).
	$: loading = !data;

	$: bookEntries = data.entries?.map((e) => ({ __kind: "book", ...e })) as InventoryTableData[];
	$: customItemEntries = data.customItems?.map((e) => ({ __kind: "custom", ...e })) as InventoryTableData[];
	$: entries = bookEntries.concat(customItemEntries);

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

	const handlePrint = () => {
		window.print();
	};
	// #region csv
	const handleExportCsv = () => {
		const csvConfig = mkConfig({
			columnHeaders: [
				{ displayLabel: t.column_headers.quantity(), key: "quantity" },
				{ displayLabel: t.column_headers.isbn(), key: "isbn" },
				{ displayLabel: t.column_headers.title(), key: "title" },
				{ displayLabel: t.column_headers.publisher(), key: "publisher" },
				{ displayLabel: t.column_headers.authors(), key: "authors" },
				{ displayLabel: t.column_headers.year(), key: "year" },
				{ displayLabel: t.column_headers.price(), key: "price" },
				{ displayLabel: t.column_headers.category(), key: "category" },
				{ displayLabel: t.column_headers.edited_by(), key: "edited_by" },
				{ displayLabel: t.column_headers.out_of_print(), key: "out_of_print" }
			],
			filename: `${displayName.replace(" ", "-")}-${Date.now()}`
		});

		const gen = generateCsv(csvConfig)<Omit<InventoryTableData, "updatedAt">>(entries);
		download(csvConfig)(gen);
	};
	// #endregion csv
</script>

<HistoryPage view="history/notes" {db} {plugins}>
	<div slot="main" class="h-full w-full">
		<div class="flex w-full items-center justify-between">
			<div class="flex max-w-md flex-col">
				<div class="relative block w-full p-2">
					<div class="flex flex-row items-center gap-x-2 text-base-content">
						<h1 class="text-2xl font-bold leading-7 text-base-content">{displayName}</h1>
					</div>
				</div>

				<div class="w-fit">
					{#if updatedAt}
						<span class="badge badge-md badge-green">{t.committed_at()}: {generateUpdatedAtString(updatedAt)}</span>
					{/if}
				</div>
			</div>

			<div id="button-container" class="ml-auto flex items-center gap-x-2">
				<button on:click={handleExportCsv} class="btn-primary btn">{t.export_csv()}</button>
				<button on:click={handlePrint} class="btn-primary btn">Print Table</button>
			</div>
		</div>
		{#if loading}
			<div class="flex grow justify-center">
				<div class="mx-auto translate-y-1/2">
					<span class="loading loading-spinner loading-lg text-primary"></span>
				</div>
			</div>
		{:else if !entries.length}
			<div class="flex grow justify-center">
				<div class="mx-auto max-w-xl translate-y-1/2">
					<PlaceholderBox title={$LL.purchase_note.placeholder.scan_title()} description={$LL.purchase_note.placeholder.scan_description()}>
						<QrCode slot="icon" />
					</PlaceholderBox>
				</div>
			</div>
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
					<div use:scroll.trigger></div>
				{/if}
			</div>
		{/if}
	</div>
</HistoryPage>

<style>
	@media print {
		#button-container {
			display: none;
		}
	}
</style>
