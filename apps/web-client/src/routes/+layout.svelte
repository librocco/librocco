<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";
	import "./global.css";

	import { onDestroy, onMount } from "svelte";
	import { get } from "svelte/store";
	import { fade, fly } from "svelte/transition";

	import { Subscription } from "rxjs";
	import { createDialog, melt } from "@melt-ui/svelte";
	import { Menu } from "lucide-svelte";

	import { afterNavigate } from "$app/navigation";
	import { browser } from "$app/environment";

	import { Sidebar } from "$lib/components";

	import { IS_DEBUG, IS_E2E } from "$lib/constants";
	import { sync, syncConfig, syncActive } from "$lib/db";
	import SyncWorker from "$lib/workers/sync-worker.ts?worker";
	import WorkerInterface from "$lib/workers/WorkerInterface";

	import * as books from "$lib/db/cr-sqlite/books";
	import * as customers from "$lib/db/cr-sqlite/customers";
	import * as note from "$lib/db/cr-sqlite/note";
	import * as reconciliation from "$lib/db/cr-sqlite/order-reconciliation";
	import * as suppliers from "$lib/db/cr-sqlite/suppliers";
	import * as warehouse from "$lib/db/cr-sqlite/warehouse";
	import * as stockCache from "$lib/db/cr-sqlite/stock_cache";
	import { timeLogger } from "$lib/utils/timer";
	import { beforeNavigate } from "$app/navigation";

	import type { LayoutData } from "./$types";

	export let data: LayoutData;

	const { dbCtx } = data;

	beforeNavigate(({ to }) => {
		if (IS_DEBUG || IS_E2E) {
			timeLogger.setCurrentRoute(to?.route?.id);
		}

		// We're disabling updates to the stock cache whenever we navigate to prevent
		// invalidations (and requerying) choking up the DB for view that don't require it.
		//
		// NOTE: It is up to views that require the stock data to re-enable the cache (on load)
		//
		// NOTE: the cache will still be invalidated in the mean while, there will just be no requerying,
		// effectively turning the cache back to lazy mode
		stockCache.disableRefresh();
	});

	$: {
		// Register (and update on each change) the db and some db handlers to the window object.
		// This is used for e2e tests (easier setup through direct access to the db).
		// Additionally, we're doing this in debug mode - in case we want to interact with the DB directly (using dev console)
		if (browser && dbCtx) {
			window["db_ready"] = true;
			window["_db"] = dbCtx.db;
			window.dispatchEvent(new Event("db_ready"));

			window["books"] = books;
			window["customers"] = customers;
			window["note"] = note;
			window["reconciliation"] = reconciliation;
			window["suppliers"] = suppliers;
			window["warehouse"] = warehouse;

			window["sync"] = sync;
		}

		// This shouldn't affect much, but is here for the purpose of exhaustive handling
		if (browser && !dbCtx) {
			window["db_ready"] = false;
			window["_db"] = undefined;
		}
	}

	let availabilitySubscription: Subscription;

	// Update sync on each change to settings
	//
	// NOTE: This is safe even on server side as it will be a noop until
	// the worker is initialized
	$: if ($syncActive) {
		sync.sync($syncConfig);
	} else {
		sync.stop();
	}

	let disposer: () => void;

	onMount(() => {
		// This helps us in e2e to know when the page is interactive, otherwise Playwright will start too early
		document.body.setAttribute("hydrated", "true");

		if (IS_E2E || IS_DEBUG) {
			window["timeLogger"] = timeLogger;
		}

		// Start the sync worker
		//
		// Init worker and sync interface
		const wkr = new WorkerInterface(new SyncWorker());
		sync.init(wkr);
		sync.worker().onChangesReceived(() => (console.time("changes_processing"), console.log("changes received")));
		sync.worker().onChangesProcessed(() => (console.timeEnd("changes_processing"), console.log("changes processed")));

		// Start the sync
		if (get(syncActive)) {
			sync.sync(get(syncConfig));
		}

		// Control the invalidation of the stock cache in central spot
		// On every 'book_transaction' change, we run 'maybeInvalidate', which, in turn checks for relevant changes
		// between the last cached value and the current one and invalidates the cache if needed
		disposer = dbCtx.rx.onRange(["book_transaction"], () => stockCache.maybeInvalidate(dbCtx.db));
	});

	onDestroy(() => {
		// Stop the sync (if active)
		sync.stop(); // Safe and idempotent

		availabilitySubscription?.unsubscribe();

		disposer?.();
	});

	const {
		elements: {
			trigger: mobileNavTrigger,
			overlay: mobileNavOverlay,
			content: mobileNavContent,
			portalled: mobileNavPortalled,
			title: mobileNavTitle,
			description: mobileNavDescription
		},
		states: { open: mobileNavOpen }
	} = createDialog({
		forceVisible: true
	});

	const {
		elements: {
			overlay: syncDialogOverlay,
			content: syncDialogContent,
			portalled: syncDialogPortalled,
			title: syncDialogTitle,
			description: syncDialogDescription
		},
		states: { open: syncDialogOpen }
	} = createDialog({
		forceVisible: true
	});
	$: $syncDialogOpen = true;

	afterNavigate(() => {
		if ($mobileNavOpen) {
			$mobileNavOpen = false;
		}
	});
</script>

<div class="flex h-full bg-base-200 lg:divide-x lg:divide-base-content">
	<div class="hidden h-full w-72 lg:block">
		<Sidebar />
	</div>

	<!-- flex flex-1 flex-col justify-items-center overflow-y-auto -->
	<main class="h-full w-full overflow-y-auto">
		{#if !$mobileNavOpen}
			<!--TODO:  add aria-label to dict-->
			<button use:melt={$mobileNavTrigger} class="btn-ghost btn-square btn fixed left-3 top-2 z-[200] lg:hidden">
				<Menu size={24} aria-hidden />
			</button>
		{/if}

		<slot />
	</main>
</div>

{#if $mobileNavOpen}
	<div use:melt={$mobileNavPortalled}>
		<div use:melt={$mobileNavOverlay} class="fixed inset-0 z-[100] bg-black/50" transition:fade|global={{ duration: 150 }}></div>

		<div
			use:melt={$mobileNavContent}
			class="fixed bottom-0 left-0 top-0 z-[200] h-full w-2/3 max-w-md overflow-y-auto bg-base-200"
			transition:fly|global={{
				x: -350,
				duration: 300,
				opacity: 1
			}}
		>
			<h2 class="sr-only" use:melt={$mobileNavTitle}>
				<!-- TODO: add dialog title to dict-->
			</h2>

			<p class="sr-only" use:melt={$mobileNavDescription}>
				<!-- TODO: add dialog description to dict -->
			</p>
			<Sidebar />
		</div>
	</div>
{/if}

{#if $syncDialogOpen}
	<div use:melt={$syncDialogPortalled}>
		<div use:melt={$syncDialogOverlay} class="fixed inset-0 z-[100] bg-black/50" transition:fade|global={{ duration: 150 }}></div>

		<div
			class="fixed left-1/2 top-1/2 z-[200] max-h-screen w-full translate-x-[-50%] translate-y-[-50%] overflow-y-auto px-4 md:max-w-md md:px-0"
			transition:fade={{ duration: 250 }}
			use:melt={$syncDialogContent}
		>
			<div class="modal-box overflow-clip rounded-lg md:shadow-2xl">
				<h2 use:melt={$syncDialogTitle} class="mb-4 text-xl font-semibold leading-7 text-gray-900">Sync in progress</h2>

				<p class="mb-4 text-sm leading-6 text-gray-600" use:melt={$syncDialogDescription}>
					<span class="mb-2 block">The initial DB sync is in progress. This might take a while</span>
					<span class="mb-2 block"
						>Please don't navigate away while the sync is in progress as it will result in broken DB and the sync will need to be restarted.</span
					>
					<!-- TODO: try and make the sync stop on unload (to avoid broken DB) -->
				</p>
			</div>
		</div>
	</div>
{/if}

<style global>
	:global(html) {
		overflow-x: hidden;
		height: 100%;
		margin-right: calc(-1 * (100vw - 100%));
	}

	:global(body) {
		height: 100%;
		padding: 0;
	}
</style>
