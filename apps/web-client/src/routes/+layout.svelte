<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";
	import "./global.css";

	import { onDestroy, onMount } from "svelte";
	import { type Readable, get } from "svelte/store";
	import { fade, fly } from "svelte/transition";

	import { Subscription } from "rxjs";
	import { createDialog, melt } from "@melt-ui/svelte";
	import { Menu } from "lucide-svelte";

	import { afterNavigate } from "$app/navigation";
	import { browser } from "$app/environment";
	import { beforeNavigate } from "$app/navigation";

	import type { LayoutData } from "./$types";

	import { IS_DEBUG, IS_E2E } from "$lib/constants";

	import { Sidebar } from "$lib/components";

	import SyncWorker from "$lib/workers/sync-worker.ts?worker";
	import WorkerInterface from "$lib/workers/WorkerInterface";

	import { sync, syncConfig, syncActive, dbid, newSyncProgressStore } from "$lib/db";
	import { clearDb, ErrDBSchemaMismatch, getDB, schemaName, schemaContent } from "$lib/db/cr-sqlite/db";
	import * as migrations from "$lib/db/cr-sqlite/debug/migrations";
	import * as books from "$lib/db/cr-sqlite/books";
	import * as customers from "$lib/db/cr-sqlite/customers";
	import * as note from "$lib/db/cr-sqlite/note";
	import * as reconciliation from "$lib/db/cr-sqlite/order-reconciliation";
	import * as suppliers from "$lib/db/cr-sqlite/suppliers";
	import * as warehouse from "$lib/db/cr-sqlite/warehouse";
	import * as stockCache from "$lib/db/cr-sqlite/stock_cache";
	import { timeLogger } from "$lib/utils/timer";

	import type { SyncProgress } from "$lib/workers/sync-transport-control";
	import { LL } from "@librocco/shared/i18n-svelte";

	export let data: LayoutData;

	$: dbCtx = data.dbCtx;
	$: error = data.error;

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

			window["migrations"] = migrations;
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

	const syncProgressStore = newSyncProgressStore();
	const { progress } = syncProgressStore;

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

		// Start the sync progress store (listen to sync events)
		syncProgressStore.start(wkr);

		// Start the sync
		if (get(syncActive)) {
			sync.sync(get(syncConfig));
		}

		// Prevent user from navigating away if sync is in progress (this would result in an invalid DB state)
		const preventUnloadIfSyncing = (e: BeforeUnloadEvent) => {
			if (get(progress).active) {
				e.preventDefault();
				e.returnValue = "";
			}
		};
		window.addEventListener("beforeunload", preventUnloadIfSyncing);

		// Control the invalidation of the stock cache in central spot
		// On every 'book_transaction' change, we run 'maybeInvalidate', which, in turn checks for relevant changes
		// between the last cached value and the current one and invalidates the cache if needed
		disposer = dbCtx?.rx?.onRange(["book_transaction"], () => stockCache.maybeInvalidate(dbCtx.db));
	});

	onDestroy(() => {
		// Stop the sync (if active)
		sync.stop(); // Safe and idempotent
		syncProgressStore.stop(); // Safe and idempotent

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

	afterNavigate(() => {
		if ($mobileNavOpen) {
			$mobileNavOpen = false;
		}
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
	$: $syncDialogOpen = $progress.active;

	/** An action used to (reactively) update the progress bar during sync */
	function progressBar(node?: HTMLElement, progress?: Readable<SyncProgress>) {
		progress.subscribe(({ nProcessed, nTotal }) => {
			const value = nTotal > 0 ? nProcessed / nTotal : 0;
			node?.style.setProperty("width", `${value * 100}%`);
		});
	}

	const {
		elements: {
			overlay: errorDialogOverlay,
			content: errorDialogContent,
			portalled: errorDialogPortalled,
			title: errorDialogTitle,
			description: errorDialogDescription
		},
		states: { open: errorDialogOpen }
	} = createDialog({
		forceVisible: true
	});

	$: $errorDialogOpen = Boolean(error);

	const nukeDB = async () => {
		// Stop the ongoing sync
		sync.stop();
		syncActive.set(false);

		// Clear all the data in CR-SQLite IndexedDB
		await clearDb();

		// Reload the window - to avoid a huge number of issues related to
		// having to account for DB not being available, but becoming available within the same lifetime
		window.location.reload();
	};

	const automigrateDB = async () => {
		// We need to retrieve the DB directly, as the broken DB won't be passed down from the load function
		const db = await getDB($dbid);

		console.log("automigrating db to latest versin....");
		await db.automigrateTo(schemaName, schemaContent);
		console.log("automigration done");

		// Reload the window - to avoid a huge number of issues related to
		// having to account for DB not being available, but becoming available within the same lifetime
		// NOTE: commented out so we can observe the errors before navigating away, TODO: uncomment when stable
		window.location.reload();
	};

	$: ({ layout: tLayout, common: tCommon } = $LL);
</script>

<div class="flex h-full bg-base-200 lg:divide-x lg:divide-base-content">
	<div class="hidden h-full w-72 lg:block">
		<Sidebar />
	</div>

	<!-- flex flex-1 flex-col justify-items-center overflow-y-auto -->
	<main class="h-full w-full overflow-y-auto">
		{#if !$mobileNavOpen}
			<button
				use:melt={$mobileNavTrigger}
				class="btn-ghost btn-square btn fixed left-3 top-2 z-[200] lg:hidden"
				aria-label={tLayout.mobile_nav.trigger.aria_label()}
			>
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
				{tLayout.mobile_nav.dialog.title()}
			</h2>

			<p class="sr-only" use:melt={$mobileNavDescription}>
				{tLayout.mobile_nav.dialog.description()}
			</p>
			<Sidebar />
		</div>
	</div>
{/if}

{#if $syncDialogOpen}
	<div use:melt={$syncDialogPortalled}>
		<div
			on:click={(e) => e.preventDefault()}
			use:melt={$syncDialogOverlay}
			class="fixed inset-0 z-[100] bg-black/50"
			transition:fade|global={{ duration: 150 }}
		></div>

		<div
			class="fixed left-1/2 top-1/2 z-[200] max-h-screen w-full translate-x-[-50%] translate-y-[-50%] overflow-y-auto px-4 md:max-w-md md:px-0"
			transition:fade={{ duration: 250 }}
			use:melt={$syncDialogContent}
		>
			<div class="modal-box overflow-clip rounded-lg md:shadow-2xl">
				<h2 use:melt={$syncDialogTitle} class="mb-4 text-xl font-semibold leading-7 text-gray-900">{tLayout.sync_dialog.title()}</h2>

				<div class="mb-4 text-sm leading-6 text-gray-600" use:melt={$syncDialogDescription}>
					<p class="mb-8">{tLayout.sync_dialog.description.in_progress()}</p>

					<p class="mb-2">{tLayout.sync_dialog.description.progress({ nProcessed: $progress.nProcessed, nTotal: $progress.nTotal })}</p>
					<div class="mb-8 h-3 w-full overflow-hidden rounded">
						<div use:progressBar={progress} class="h-full bg-cyan-300"></div>
					</div>

					<p>
						{tLayout.sync_dialog.description.warning()}
					</p>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if $errorDialogOpen}
	<div use:melt={$errorDialogPortalled}>
		<div use:melt={$errorDialogOverlay} class="fixed inset-0 z-[100] bg-black/50" transition:fade|global={{ duration: 150 }}></div>

		<div
			class="fixed left-1/2 top-1/2 z-[200] max-h-screen w-full translate-x-[-50%] translate-y-[-50%] overflow-y-auto px-4 md:max-w-md md:px-0"
			transition:fade={{ duration: 250 }}
			use:melt={$errorDialogContent}
		>
			<div class="modal-box overflow-clip rounded-lg md:shadow-2xl">
				{#if error.name === ErrDBSchemaMismatch.name}
					<h2 use:melt={$errorDialogTitle} class="mb-4 text-xl font-semibold leading-7 text-gray-900">
						{tLayout.error_dialog.schema_mismatch.title()}
					</h2>

					<p class="mb-4 text-sm leading-6 text-gray-600" use:melt={$errorDialogDescription}>
						<span class="mb-2 block">
							{tLayout.error_dialog.schema_mismatch.description()}
						</span>
						<span class="ml-4 block">
							{tLayout.error_dialog.schema_mismatch.latest_version({ wantVersion: (error as ErrDBSchemaMismatch).wantVersion })}
						</span>
						<span class="ml-4 block">
							{tLayout.error_dialog.schema_mismatch.your_version({ gotVersion: (error as ErrDBSchemaMismatch).gotVersion })}
						</span>
					</p>

					<div class="w-full text-end">
						<button on:click={automigrateDB} type="button" class="btn-secondary btn">
							{tLayout.error_dialog.schema_mismatch.button()}
						</button>
					</div>
				{:else}
					<h2 use:melt={$errorDialogTitle} class="mb-4 text-xl font-semibold leading-7 text-gray-900">
						{tLayout.error_dialog.corrupted.title()}
					</h2>

					<p class="mb-2 text-sm leading-6 text-gray-600" use:melt={$errorDialogDescription}>
						<span class="mb-2 block">{tLayout.error_dialog.corrupted.description()}</span>
						<span class="mb-4 block">
							{tLayout.error_dialog.corrupted.note()}
						</span>
					</p>

					<div class="w-full text-end">
						<button on:click={nukeDB} type="button" class="btn-secondary btn">
							{tLayout.error_dialog.corrupted.button()}
						</button>
					</div>
				{/if}
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
