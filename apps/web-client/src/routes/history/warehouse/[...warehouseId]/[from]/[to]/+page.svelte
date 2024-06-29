<script lang="ts">
	import { ArrowLeft, ArrowRight, FileCheck } from "lucide-svelte";
	import { now, getLocalTimeZone, type DateValue } from "@internationalized/date";

	import { entityListView, testId } from "@librocco/shared";

	import { goto } from "$lib/utils/navigation";
	import { browser } from "$app/environment";

	import type { PageData } from "./$types";

	import { HistoryPage, PlaceholderBox } from "$lib/components";

	import { createWarehouseHistoryStores } from "$lib/stores/inventory/history_entries";

	import { getDB } from "$lib/db";

	import { appPath } from "$lib/paths";
	import { generateUpdatedAtString } from "$lib/utils/time";
	import CalendarPicker from "$lib/components/CalendarPicker.svelte";
	import { download, generateCsv, mkConfig } from "export-to-csv";
	import type { DisplayRow } from "$lib/types/inventory";

	export let data: PageData;

	// #region date picker
	const isEqualDateValue = (a?: DateValue, b?: DateValue): boolean => {
		if (!a || !b) return false;
		return a.toString().slice(0, 10) === b.toString().slice(0, 10);
	};

	const onDateValueChange =
		(which: "to" | "from") =>
		({ next }) => {
			// Redirect only in browser, if data value is different then the one in route param
			if (browser && !isEqualDateValue(data[which].dateValue, next)) {
				const path =
					which === "from"
						? appPath("history/warehouse", data.warehouseId, next.toString().slice(0, 10), data.to.date)
						: appPath("history/warehouse", data.warehouseId, data.from.date, next.toString().slice(0, 10));
				// The replaceState part allows us to have the date as part of the route (for sharing/reaload),
				// whilst keeping the date changes a single history entry (allowing for quick 'back' navigation)
				goto(path);
			}
			return next;
		};

	const isDateDisabled = (date: DateValue) => {
		return date > now(getLocalTimeZone());
	};
	// #endregion date picker

	// #region dropdown
	let filter = "";
	const options = [
		{
			label: "All",
			value: ""
		},
		{
			label: "Inbound",
			value: "inbound"
		},
		{
			label: "Outbound",
			value: "outbound"
		}
	];
	const selectFilter = (value: string) => () => (filter = value);
	// #endregion dropdown

	// #region csv
	type CsvEntries = Omit<DisplayRow<"book">, "warehouseId" | "availableWarehouses">;
	const handleExportCsv = () => {
		const csvConfig = mkConfig({
			columnHeaders: [
				{ displayLabel: "Quantity", key: "quantity" },
				{ displayLabel: "ISBN", key: "isbn" },
				{ displayLabel: "Title", key: "title" },
				{ displayLabel: "Publisher", key: "publisher" },
				{ displayLabel: "Authors", key: "authors" },
				{ displayLabel: "Year", key: "year" },
				{ displayLabel: "Price", key: "price" },
				{ displayLabel: "Category", key: "category" },
				{ displayLabel: "Edited by", key: "edited_by" },
				{ displayLabel: "Out of print", key: "out_of_print" }
			],
			filename: `${$displayName.replace(" ", "-")}-${Date.now()}`
		});

		const gen = generateCsv(csvConfig)<CsvEntries>(
			$transactions.map((txn) => ({ ...txn, quantity: txn.noteType === "outbound" ? -txn.quantity : txn.quantity }))
		);
		download(csvConfig)(gen);
	};
	// #endregion csv

	const { db } = getDB();

	const dailySummaryCtx = { name: "[DAILY_SUMMARY]", debug: false };
	$: historyStores = createWarehouseHistoryStores(dailySummaryCtx, db, data.warehouseId, data.from.dateValue, data.to.dateValue, filter);
	$: transactions = historyStores.transactions;
	$: displayName = historyStores.displayName;
</script>

<HistoryPage view="history/date">
	<svelte:fragment slot="heading">
		<div class="flex w-full flex-wrap justify-between gap-y-4 xl:flex-nowrap">
			<h1 class="order-1 whitespace-nowrap text-2xl font-bold leading-7 text-gray-900">{$displayName || ""} history</h1>

			<button on:click={handleExportCsv} class="button button-green order-2 whitespace-nowrap xl:order-3">Export CSV</button>

			<div class="order-3 w-full items-center gap-3 md:flex xl:order-2 xl:justify-center">
				<p>From:</p>
				<div class="mb-4 inline-block md:mb-0">
					<CalendarPicker onValueChange={onDateValueChange("from")} defaultValue={data.from.dateValue} {isDateDisabled} />
				</div>
				<p>To:</p>
				<div class="mb-4 inline-block md:mb-0">
					<CalendarPicker onValueChange={onDateValueChange("to")} defaultValue={data.to.dateValue} {isDateDisabled} />
				</div>

				<p>Filter:</p>
				<div class="inline-block">
					<div class="mt-1 flex items-center divide-x divide-gray-300 overflow-hidden rounded-md border">
						{#each options as { label, value }}
							{@const active = value === filter}
							<button
								on:click={selectFilter(value)}
								class="{active ? 'button-green' : 'button-white'} whitespace-nowrap border-none px-3 py-1"
								class:selected={filter === value}
							>
								{label}
							</button>
						{/each}
					</div>
				</div>
			</div>
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
				<div class="sticky top-0">
					<h2 class="border-b border-gray-300 bg-white px-4 py-4 pt-8 text-xl font-semibold">Transactions</h2>
				</div>
				<ul class="grid w-full grid-cols-12 divide-y">
					{#each $transactions as txn}
						<li class="entity-list-row col-span-12 grid grid-cols-12 items-center gap-4 whitespace-nowrap text-gray-800">
							<p class="col-span-12 overflow-hidden font-semibold lg:col-span-2 lg:font-normal">
								{generateUpdatedAtString(txn.date)}
							</p>

							<div class="col-span-8 grid items-center gap-x-4 md:grid-cols-1 lg:col-span-7 lg:grid-cols-7 xl:col-span-8 xl:grid-cols-8">
								<p class="col-span-2 overflow-hidden">{txn.isbn}</p>

								<p class="col-span-3 overflow-hidden">{txn.title || "Unkonwn Title"}</p>

								<p class="col-span-2 overflow-hidden xl:col-span-3">{txn.authors || ""}</p>
							</div>

							<a
								href={appPath("history/notes", txn.noteId)}
								class="col-span-4 flex items-center overflow-hidden lg:col-span-3 xl:col-span-2"
							>
								{#if txn.noteType === "inbound"}
									<div class="badge-green mx-4 flex items-center rounded-sm px-3">
										<p><ArrowLeft size={16} /></p>
										<p>{txn.quantity}</p>
									</div>
								{:else}
									<div class="badge-red mx-4 flex items-center rounded-sm px-3">
										<p>{txn.quantity}</p>
										<p><ArrowRight size={16} /></p>
									</div>
								{/if}

								<p>{txn.noteDisplayName}</p>
							</a>
						</li>
					{/each}
				</ul>
				<!-- End entity list -->
			{/if}
		</div>
		<!-- End entity list contaier -->
	</svelte:fragment>
</HistoryPage>
