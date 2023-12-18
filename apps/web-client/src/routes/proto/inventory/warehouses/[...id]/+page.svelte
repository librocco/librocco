<script lang="ts">
	import { Search } from "lucide-svelte";

	import { Page, PlaceholderBox, Breadcrumbs, createBreadcrumbs } from "$lib/components";

	import { goto } from "$app/navigation";

	import { writable } from "svelte/store";

	import { InventoryTable, createTable, ProgressBar } from "@librocco/ui";
	import { debug } from "@librocco/shared";

	import type { PageData } from "./$types";

	import { getDB } from "$lib/db";

	import { noteToastMessages, toastSuccess } from "$lib/toasts";

	import { createWarehouseStores } from "$lib/stores/proto";

	import { createIntersectionObserver } from "$lib/actions";

	import { readableFromStream } from "$lib/utils/streams";

	import { appPath } from "$lib/paths";

	export let data: PageData;

	// Db will be undefined only on server side. If in browser,
	// it will be defined immediately, but `db.init` is ran asynchronously.
	// We don't care about 'db.init' here (for nav stream), hence the non-reactive 'const' declaration.
	const db = getDB();

	const publisherListCtx = { name: "[PUBLISHER_LIST::INBOUND]", debug: false };
	const publisherList = readableFromStream(publisherListCtx, db?.books().streamPublishers(publisherListCtx), []);

	// We display loading state before navigation (in case of creating new note/warehouse)
	// and reset the loading state when the data changes (should always be truthy -> thus, loading false).
	$: loading = !data;

	$: warehouse = data.warehouse;

	const warehouseCtx = new debug.DebugCtxWithTimer(`[WAREHOUSE_ENTRIES::${warehouse?._id}]`, { debug: false, logTimes: false });
	$: warehouesStores = createWarehouseStores(warehouseCtx, warehouse);

	$: displayName = warehouesStores.displayName;
	$: entries = warehouesStores.entries;

	// #region warehouse-actions
	/**
	 * Handle create warehouse is an `no:click` handler used to create the new warehouse
	 * _(and navigate to the newly created warehouse page)_.
	 */
	const handleCreateNote = async () => {
		loading = true;
		const note = await warehouse?.note().create();
		await goto(appPath("inbound", note._id));
		toastSuccess(noteToastMessages("Note").inNoteCreated);
	};
	// #endregion warehouse-actions

	// #region infinite-scroll
	let maxResults = 20;
	// Allow for pagination-like behaviour (rendering 20 by 20 results on see more clicks)
	const seeMore = () => (maxResults += 20);
	// We're using in intersection observer to create an infinite scroll effect
	const scroll = createIntersectionObserver(seeMore);
	// #endregion infinite-scroll

	// #region table
	const tableOptions = writable({
		data: $entries?.slice(0, maxResults)
	});

	const table = createTable(tableOptions);

	$: tableOptions.set({ data: $entries?.slice(0, maxResults) });
	// #endregion table

	$: breadcrumbs = createBreadcrumbs("warehouse", { id: warehouse?._id, displayName: warehouse?.displayName });
</script>

<Page>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<Breadcrumbs class="mb-3" links={breadcrumbs} />
		<h1 class="mb-2 text-2xl font-bold leading-7 text-gray-900">{$displayName}</h1>
	</svelte:fragment>

	<svelte:fragment slot="main">
		{#if loading}
			<ProgressBar class="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
		{:else if !$entries.length}
			<PlaceholderBox title="Add new inbound note" description="Get started by adding a new note" class="center-absolute">
				<button on:click={handleCreateNote} class="mx-auto flex items-center gap-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
					><span class="text-green-50">New note</span></button
				>
			</PlaceholderBox>
		{:else}
			<div use:scroll.container={{ rootMargin: "400px" }} class="h-full overflow-y-scroll">
				<InventoryTable {table} />

				<!-- Trigger for the infinite scroll intersection observer -->
				{#if $entries?.length > maxResults}
					<div use:scroll.trigger />
				{/if}
			</div>
		{/if}
	</svelte:fragment>
</Page>
