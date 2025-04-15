<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { ArrowLeft, ArrowRight } from "lucide-svelte";
	import { now, getLocalTimeZone, type DateValue } from "@internationalized/date";
	import { download, generateCsv, mkConfig } from "export-to-csv";
	import { browser } from "$app/environment";
	import { invalidate } from "$app/navigation";

	import { entityListView, testId, type TranslationFunctions } from "@librocco/shared";

	import type { PastTransactionItem } from "$lib/db/cr-sqlite/types";

	import { racefreeGoto } from "$lib/utils/navigation";

	import type { PageData } from "./$types";

	import { PlaceholderBox } from "$lib/components";
	import CalendarPicker from "$lib/components/CalendarPicker.svelte";
	import { HistoryPage } from "$lib/controllers";

	import { generateUpdatedAtString } from "$lib/utils/time";

	import { appPath } from "$lib/paths";
	import LL from "@librocco/shared/i18n-svelte";
	import type { LocalizedString } from "typesafe-i18n";

	export let data: PageData;

	$: ({ plugins, displayName, transactions, noteType: filter } = data);
	$: db = data.dbCtx?.db;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// NOTE: dbCtx should always be defined on client
		const { rx } = data.dbCtx;

		// Reload when book data changes, or when a note "changes" (we're interested in committed change)
		// We don't subscribe to book_transaction as we're only interested in committed txns - and this is triggered by note change
		disposer = rx.onRange(["book", "note"], () => invalidate("history:transactions"));
	});
	onDestroy(() => {
		// Unsubscribe on unmount
		disposer?.();
	});

	$: goto = racefreeGoto(disposer);

	$: t = $LL.history_page.warehouse_tab.note_table;

	let tt: { [option: string]: () => LocalizedString };
	LL.subscribe((LL) => {
		// Update the translation object
		tt = LL.history_page.warehouse_tab.note_table.filter_options;
	});

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
	const options = [
		{
			label: tt.all(),
			value: ""
		},
		{
			label: tt.inbound(),
			value: "inbound"
		},
		{
			label: tt.outbound(),
			value: "outbound"
		}
	];
	const selectFilter = (value: string) => () => goto(appPath("history/warehouse", data.warehouseId, data.from.date, data.to.date, value));
	// #endregion dropdown

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

		const gen = generateCsv(csvConfig)<Omit<PastTransactionItem, "committedAt">>(
			transactions.map((txn) => ({ ...txn, quantity: txn.noteType === "outbound" ? -txn.quantity : txn.quantity }))
		);
		download(csvConfig)(gen);
	};
	// #endregion csv
</script>

<HistoryPage view="history/date" {db} {plugins}>
	<svelte:fragment slot="heading">
		<div class="flex w-full flex-wrap justify-between gap-y-4 xl:flex-nowrap">
			<h1 class="order-1 whitespace-nowrap text-2xl font-bold leading-7 text-gray-900">
				{displayName || ""}
				{t.heading.history()}
			</h1>

			<button on:click={handleExportCsv} class="button button-green order-2 whitespace-nowrap xl:order-3">{t.heading.export_csv()}</button>

			<div class="order-3 w-full items-center gap-3 md:flex xl:order-2 xl:justify-center">
				<p>{t.heading.from()}:</p>
				<div class="mb-4 inline-block md:mb-0">
					<CalendarPicker
						id="calendar-from"
						onValueChange={onDateValueChange("from")}
						defaultValue={data.from.dateValue}
						{isDateDisabled}
					/>
				</div>
				<p>{t.heading.to()}:</p>
				<div class="mb-4 inline-block md:mb-0">
					<CalendarPicker id="calendar-to" onValueChange={onDateValueChange("to")} defaultValue={data.to.dateValue} {isDateDisabled} />
				</div>

				<p>{t.heading.filter()}:</p>
				<div id="inbound-outbound-filter" class="inline-block">
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
		<div class={testId("entity-list-container")} data-view={entityListView("outbound-list")}>
			{#if !transactions?.length}
				<!-- Start entity list placeholder -->
				<PlaceholderBox
					title="No transactions found"
					description="There seem to be no transactions going in/out for the selected date range"
					class="center-absolute"
				/>
				<!-- End entity list placeholder -->
			{:else}
				<div class="sticky top-0">
					<h2 class="border-b border-gray-300 bg-white px-4 py-4 pt-8 text-xl font-semibold">
						{t.titles.transactions()}
					</h2>
				</div>
				<ul id="history-table" class="grid w-full grid-cols-12 divide-y">
					{#each transactions as txn}
						<li class="entity-list-row col-span-12 grid grid-cols-12 items-center gap-4 whitespace-nowrap text-gray-800">
							<p data-property="committedAt" class="col-span-12 overflow-hidden font-semibold lg:col-span-2 lg:font-normal">
								{generateUpdatedAtString(txn.committedAt)}
							</p>

							<div class="col-span-8 grid items-center gap-x-4 md:grid-cols-1 lg:col-span-7 lg:grid-cols-7 xl:col-span-8 xl:grid-cols-8">
								<p data-property="isbn" class="col-span-2 overflow-hidden">{txn.isbn}</p>

								<p data-property="title" class="col-span-3 overflow-hidden">{txn.title || "Unkonwn Title"}</p>

								<p data-property="authors" class="col-span-2 overflow-hidden xl:col-span-3">{txn.authors || ""}</p>
							</div>

							<a
								href={appPath("history/notes/archive", txn.noteId)}
								class="col-span-4 flex items-center overflow-hidden lg:col-span-3 xl:col-span-2"
							>
								{#if txn.noteType === "inbound"}
									<div class="badge-green mx-4 flex items-center rounded-sm px-3">
										<p><ArrowLeft size={16} /></p>
										<p data-property="quantity">{txn.quantity}</p>
									</div>
								{:else}
									<div class="badge-red mx-4 flex items-center rounded-sm px-3">
										<p data-property="quantity">{txn.quantity}</p>
										<p><ArrowRight size={16} /></p>
									</div>
								{/if}

								<p data-property="noteName">{txn.noteName}</p>
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
