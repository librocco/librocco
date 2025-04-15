<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { Library, ArrowLeft, ArrowRight } from "lucide-svelte";
	import { now, getLocalTimeZone, type DateValue } from "@internationalized/date";
	import { invalidate } from "$app/navigation";

	import { entityListView, testId } from "@librocco/shared";

	import { racefreeGoto } from "$lib/utils/navigation";
	import { browser } from "$app/environment";

	import type { PageData } from "./$types";

	import { PlaceholderBox, CalendarPicker } from "$lib/components";
	import { HistoryPage } from "$lib/controllers";

	import { appPath } from "$lib/paths";
	import { generateUpdatedAtString } from "$lib/utils/time";
	import { LL } from "@librocco/shared/i18n-svelte";

	export let data: PageData;

	$: ({ stats, bookList, dateValue, plugins } = data);
	$: db = data.dbCtx?.db;

	$: t = $LL.history_page.date_tab;

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

	// #region date picker
	const isEqualDateValue = (a?: DateValue, b?: DateValue): boolean => {
		if (!a || !b) return false;
		return a.toString().slice(0, 10) === b.toString().slice(0, 10);
	};
	const defaultDateValue = dateValue;
	const onDateValueChange = ({ next }) => {
		if (!next) return;
		// Redirect only in browser, if data value is different then the one in route param
		if (browser && !isEqualDateValue(dateValue, next)) {
			// The replaceState part allows us to have the date as part of the route (for sharing/reaload),
			// whilst keeping the date changes a single history entry (allowing for quick 'back' navigation)
			goto(appPath("history/date", next.toString().slice(0, 10)), { replaceState: true });
		}
		return next;
	};
	const isDateDisabled = (date: DateValue) => {
		return date > now(getLocalTimeZone());
	};
	// #endregion date picker
</script>

<HistoryPage view="history/date" {db} {plugins}>
	<div slot="main" class="h-full w-full">
		<div class="flex w-full justify-between">
			<div class="flex w-full flex-col items-center gap-3">
				<CalendarPicker onValueChange={onDateValueChange} defaultValue={defaultDateValue} {isDateDisabled} />
			</div>
		</div>
		<!-- Start entity list contaier -->

		<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
		<div class={testId("entity-list-container")} data-view={entityListView("outbound-list")}>
			{#if !bookList?.length}
				<!-- Start entity list placeholder -->
				<PlaceholderBox title="No Books on that date" description="Try selecting a different date." class="center-absolute" />
				<!-- End entity list placeholder -->
			{:else}
				<h2 class="px-4 py-4 pt-8 text-xl font-semibold">{t.stats.title()}</h2>

				<div data-testid={testId("history-date-stats")}>
					<div class="flex flex-row text-sm">
						<div class="badge badge-green m-2 p-2 font-bold">
							{t.stats.total_inbound_book_count()}:
							<span data-property="inbound-count">{stats.totalInboundBookCount}</span>
						</div>
						<div class="badge badge-green m-2 p-2 font-bold">
							{t.stats.total_inbound_cover_price()}:
							<span data-property="inbound-cover-price">{stats.totalInboundCoverPrice.toFixed(2)}</span>
						</div>
						<div class="badge badge-green m-2 p-2 font-bold">
							{t.stats.total_inbound_cover_price()}:
							<span data-property="inbound-discounted-price">{stats.totalInboundDiscountedPrice.toFixed(2)}</span>
						</div>
					</div>

					<div class="flex flex-row text-sm">
						<div class="badge badge-red m-2 p-2 font-bold">
							{t.stats.total_outbound_book_count()}:
							<span data-property="outbound-count">{stats.totalOutboundBookCount}</span>
						</div>
						<div class="badge badge-red m-2 p-2 font-bold">
							{t.stats.total_outbound_cover_price()}:
							<span data-property="outbound-cover-price">{stats.totalOutboundCoverPrice.toFixed(2)}</span>
						</div>
						<div class="badge badge-red m-2 p-2 font-bold">
							{t.stats.total_outbound_discounted_price()}:
							<span data-property="outbound-discounted-price">{stats.totalOutboundDiscountedPrice.toFixed(2)}</span>
						</div>
					</div>
				</div>

				<h2 class="px-4 py-4 pt-8 text-xl font-semibold">
					{t.transactions.title()}: <span data-property="transactions">{stats.totalOutboundBookCount}</span>
				</h2>

				<div id="history-table" class="w-full">
					<ul class="w-full divide-y divide-gray-300">
						{#each bookList as { isbn, title, quantity, warehouseName, committedAt, noteType, noteName, noteId }}
							<!--<div class="w-full text-gray-700">
								<p class="mt-2 mb-1 text-sm font-semibold leading-none text-gray-900">{isbn}</p>
								<p class="mb-1 text-2xl">{title}</p>
							</div>-->

							<li
								class="entity-list-row grid w-full grid-cols-2 items-center gap-x-4 gap-y-3 py-6 text-gray-800 sm:grid-cols-3 lg:grid-cols-12 lg:gap-y-2 lg:py-4 xl:grid-cols-12"
							>
								<p data-property="isbn" class="text-xl font-medium leading-none text-gray-900 lg:col-span-3 xl:col-span-2">{isbn}</p>
								<p
									data-property="title"
									class="col-span-2 overflow-hidden whitespace-nowrap text-xl font-medium lg:col-span-5 xl:col-span-3"
								>
									{title || "Unknown Title"}
								</p>
								<p class="lg:order-4 xl:order-none xl:col-span-2">
									<span data-property="committedAt" class="badge badge-md {noteType === 'inbound' ? 'badge-green' : 'badge-red'}">
										{t.transactions.committed()}: {generateUpdatedAtString(committedAt)}
									</span>
								</p>

								<div class="col-span-2 flex items-center lg:col-span-4 lg:col-start-9 xl:col-span-4 xl:col-start-9">
									<div class="flex items-center">
										<Library class="mr-1" size={20} />
										<p data-property="warehouseName" class="entity-list-text-sm">{warehouseName}</p>
									</div>

									<a
										href={appPath("history/notes/archive", noteId)}
										class="{noteType === 'outbound'
											? 'text-red-700'
											: 'text-green-700'} mx-4 flex items-center rounded-sm border bg-gray-50 px-3 py-0.5 hover:font-semibold"
									>
										{#if noteType === "inbound"}
											<p><ArrowLeft size={16} /></p>
											<p data-property="quantity">{quantity}</p>
										{:else}
											<p data-property="quantity">{quantity}</p>
											<p><ArrowRight size={16} /></p>
										{/if}
										<p data-property="noteName" class="ml-2">{noteName}</p>
									</a>
								</div>
							</li>
						{/each}
					</ul>
				</div>
				<!-- End entity list -->
			{/if}
		</div>
		<!-- End entity list contaier -->
	</div>
</HistoryPage>
