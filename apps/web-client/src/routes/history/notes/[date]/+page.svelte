<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import Library from "$lucide/library";
	import { now, getLocalTimeZone, type DateValue } from "@internationalized/date";
	import { browser } from "$app/environment";
	import { invalidate } from "$app/navigation";

	import { entityListView, testId } from "@librocco/shared";

	import type { PageData } from "./$types";

	import CalendarPicker from "$lib/components/CalendarPicker.svelte";
	import { PlaceholderBox } from "$lib/components";
	import { HistoryPage } from "$lib/controllers";

	import { generateUpdatedAtString } from "$lib/utils/time";
	import { racefreeGoto } from "$lib/utils/navigation";

	import { appPath } from "$lib/paths";
	import LL from "@librocco/shared/i18n-svelte";

	export let data: PageData;

	$: ({ notes, plugins } = data);
	$: db = data.dbCtx?.db;

	$: t = $LL.history_page.notes_tab;

	// #region reactivity
	let disposer: () => void;
	onMount(() => {
		// Reload when note/warehouse changes (warehouse name/discount, note committed status)
		disposer = data.dbCtx?.rx?.onRange(["note", "warehouse"], () => invalidate("history:notes"));
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
</script>

<HistoryPage view="history/notes" {db} {plugins}>
	<div slot="main" class="h-full w-full">
		<div class="flex w-full justify-between">
			<div class="flex w-full flex-col items-center gap-3">
				<CalendarPicker onValueChange={onDateValueChange} defaultValue={defaultDateValue} {isDateDisabled} />
			</div>
		</div>
		<!-- Start entity list contaier -->

		<!-- 'entity-list-container' class is used for styling, as well as for e2e test selector(s). If changing, expect the e2e to break - update accordingly -->
		<ul class={testId("entity-list-container")} data-view={entityListView("history/notes")}>
			{#if !notes.length}
				<div class="flex grow justify-center">
					<div class="mx-auto max-w-xl translate-y-1/2">
						<PlaceholderBox title={t.placeholder.title()} description={t.placeholder.description()} />
					</div>
				</div>
			{:else}
				<!-- Start entity list -->
				{#each notes as note}
					{@const displayName = `${note.warehouseName} / ${note.displayName}`}
					{@const totalBooks = note.totalBooks}
					{@const href = appPath("history/notes/archive", note.id)}

					<div class="group entity-list-row">
						<div class="block w-full">
							<a {href} class="entity-list-text-lg mb-2 block text-base-content hover:underline focus:underline">{displayName}</a>

							<div class="grid w-full grid-cols-4 items-start gap-2 lg:grid-cols-8">
								<div class="order-1 col-span-2 flex gap-x-0.5 lg:col-span-1">
									<Library class="mr-1 text-base-content" size={24} />
									<span class="entity-list-text-sm text-base-content">{totalBooks} {t.date.books()}</span>
								</div>

								<p class="order-2 col-span-2 text-base-content lg:order-3">
									{t.date.total_cover_price()}:
									<span class="text-base-content">{note.totalCoverPrice.toFixed(2)}</span>
								</p>

								<p class="order-3 col-span-2 lg:order-2">
									<span class="badge badge-md {note.noteType === 'inbound' ? 'badge-green' : 'badge-red'}">
										{t.date.committed()}: {generateUpdatedAtString(note.committedAt, "time-only")}
									</span>
								</p>

								<p class="order-4 col-span-2 text-base-content">
									{t.date.total_discounted_price()}:
									<span class="text-base-content">{note.totalDiscountedPrice.toFixed(2)}</span>
								</p>
							</div>
						</div>
					</div>
				{/each}
				<!-- End entity list -->
			{/if}
		</ul>
		<!-- End entity list contaier -->
	</div>
</HistoryPage>
