<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";
	import "./global.css";

	import { onMount } from "svelte";
	import { get, writable } from "svelte/store";
	import { fade, fly } from "svelte/transition";
	import { createDialog, melt } from "@melt-ui/svelte";
	import { Subscription } from "rxjs";

	import Menu from "$lucide/menu";

	import { afterNavigate, invalidateAll } from "$app/navigation";
	import { beforeNavigate } from "$app/navigation";

	import { app, getDb, getDbRx, getVfs } from "$lib/app";

	import type { LayoutData } from "./$types";

	import { DEMO_DB_NAME, DEMO_DB_URL, IS_DEBUG, IS_E2E } from "$lib/constants";

	import { Sidebar } from "$lib/components";

	import SyncWorker from "$lib/workers/sync-worker.ts?worker";
	import WorkerInterface from "$lib/workers/WorkerInterface";

	import { sync, syncConfig, syncActive, syncProgressStore, initStore } from "$lib/db";
	import { clearDb, dbCache } from "$lib/db/cr-sqlite/db";
	import { ErrDemoDBNotInitialised } from "$lib/db/cr-sqlite/errors";
	import * as migrations from "$lib/db/cr-sqlite/debug/migrations";
	import * as books from "$lib/db/cr-sqlite/books";
	import * as customers from "$lib/db/cr-sqlite/customers";
	import * as note from "$lib/db/cr-sqlite/note";
	import * as reconciliation from "$lib/db/cr-sqlite/order-reconciliation";
	import * as suppliers from "$lib/db/cr-sqlite/suppliers";
	import * as warehouse from "$lib/db/cr-sqlite/warehouse";
	import * as stockCache from "$lib/db/cr-sqlite/stock_cache";
	import { timeLogger } from "$lib/utils/timer";

	import { default as Toaster, toastError } from "$lib/components/Melt/Toaster.svelte";

	import { LL } from "@librocco/shared/i18n-svelte";
	import { getRemoteDB } from "$lib/db/cr-sqlite/core/remote-db";
	import { deleteDBFromOPFS, checkOPFSFileExists, fetchAndStoreDBFile } from "$lib/db/cr-sqlite/core/utils";

	import { progressBar } from "$lib/actions";

	import { appPath } from "$lib/paths";

	export let data: LayoutData;

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

	// Attach window helpers, these are used for:
	// - manual interactions with the app (through console)
	// - as bridged DB interactions from Playwright environment
	//   (Playwright uses window to retrieve the App, DB, and appropriate DB handlers - ensuring DRY and single-source of truth)
	onMount(() => {
		window["_app"] = app;
		window["_getDb"] = getDb;
		window["_getRemoteDB"] = getRemoteDB; // TODO: revisit this

		window["books"] = books;
		window["customers"] = customers;
		window["note"] = note;
		window["reconciliation"] = reconciliation;
		window["suppliers"] = suppliers;
		window["warehouse"] = warehouse;

		window["sync"] = sync;
		window["migrations"] = migrations;
		window["deleteDBFromOPFS"] = (dbname: string) => deleteDBFromOPFS({ dbname, dbCache, syncActiveStore: syncActive });
	});

	// Signal (to Playwright) that the DB is initialised
	onMount(async () => {
		await getDb(app);
		window["db_ready"] = true;
		window.dispatchEvent(new Event("db_ready"));
	});

	let availabilitySubscription: Subscription;

	// Update sync on each change to settings
	//
	// NOTE: This is safe with respect to initialisation as it runs only if DB ready
	const dbReady = app.db.ready;
	$: if ($dbReady && $syncActive) {
		// Subsequent activations use regular sync
		sync.sync($syncConfig, { invalidateAll });
	}
	$: if ($dbReady && !$syncActive) {
		sync.stop();
	}

	// Sync
	const { progress: syncProgress } = syncProgressStore;

	onMount(() => {
		// This helps us in e2e to know when the page is interactive
		document.body.setAttribute("hydrated", "true");

		if (IS_E2E || IS_DEBUG) {
			window["timeLogger"] = timeLogger;
		}
		// Control the invalidation of the stock cache
		// On every 'book_transaction' change, we run 'maybeInvalidate', which checks for relevant changes
		// between the last cached value and the current one and invalidates the cache if needed
		const disposer = getDbRx(app).onRange(["book_transaction"], async () => stockCache.maybeInvalidate(await getDb(app)));

		// 3. Sync setup (not supported in demo mode)
		// Only start sync when DB is ready

		let preventUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

		const initUnsubscribe = initStore.subscribe((state) => {
			if (state.phase !== "ready") return;

			// DB is ready, start sync worker
			const wkr = new WorkerInterface(new SyncWorker());
			const vfs = getVfs(app);

			wkr.start(vfs);
			sync.init(wkr);

			// Start the sync if it should be active
			if ($syncActive) {
				sync.sync($syncConfig, { invalidateAll });
			}

			// Start the sync progress store (listen to sync events)
			syncProgressStore.start(wkr);

			// Prevent user from navigating away if sync is in progress
			preventUnloadHandler = (e: BeforeUnloadEvent) => {
				if (get(syncProgress).active) {
					e.preventDefault();
					e.returnValue = "";
				}
			};
			window.addEventListener("beforeunload", preventUnloadHandler);
		});

		// Cleanup function
		return () => {
			// Stop the sync (if active)
			sync.stop();
			syncProgressStore.stop();

			availabilitySubscription?.unsubscribe();
			initUnsubscribe?.();
			disposer?.();

			// Run all cleanup functions
			window.removeEventListener("beforeunload", preventUnloadHandler);
		};
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

	// In order to prevent sync dialog flashing for minor changes
	// we're delaying the showing of the dialog by some timeout (syncShowDebounce),
	// and cancelling in case the sync finishes before that
	const syncShowDebounce = 2000;
	let showSyncDialogTimeout: any = null;
	$: {
		const _clearTimeout = () => {
			if (showSyncDialogTimeout) {
				clearTimeout(showSyncDialogTimeout);
				showSyncDialogTimeout = null;
			}
		};

		if ($syncProgress.active && !showSyncDialogTimeout) {
			showSyncDialogTimeout = setTimeout(() => {
				showSyncDialogTimeout.set(true);
				_clearTimeout();
			}, syncShowDebounce);
		} else {
			_clearTimeout();
			syncDialogOpen.set(false);
		}
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

	$: ({ layout: tLayout, common: tCommon } = $LL);

	// DEMO
	const demoFetchProgress = writable({ active: false, nProcessed: 0, nTotal: 0 });

	const handleFetchDemoDB = async () => {
		// Sanity check: this should be unreachable as we validate the DEMO_DB_URL at build time
		if (!DEMO_DB_URL) {
			throw new Error("DEMO_DB_URL is not set");
		}

		// Remove the existing DB (if any)
		if (await checkOPFSFileExists(DEMO_DB_NAME)) {
			await deleteDBFromOPFS({ dbname: DEMO_DB_NAME, dbCache, syncActiveStore: syncActive });
		}

		await fetchAndStoreDBFile(DEMO_DB_URL, DEMO_DB_NAME, demoFetchProgress);

		// Do a full reload as invalidation sometimes takes awhile (depending on VFS I guess...),
		// so it's nicer to show a loading state than have a feel of app hanging
		window.location.href = appPath("stock");
	};

	const handleClientSideError = (e: ErrorEvent & { currentTarget: EventTarget & Element }) => {
		toastError({
			title: tLayout.runtime_error_toast.title(),
			description: tLayout.runtime_error_toast.description(),
			detail: e.error?.message || e.message || ""
		});
	};
</script>

<svelte:window on:error={handleClientSideError} />

<div class="flex h-full bg-base-100 lg:divide-x lg:divide-base-content">
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

<Toaster />

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

					<p class="mb-2">
						{tLayout.sync_dialog.description.progress({ nProcessed: $syncProgress.nProcessed, nTotal: $syncProgress.nTotal })}
					</p>
					<div class="mb-8 h-3 w-full overflow-hidden rounded">
						<div use:progressBar={syncProgress} class="h-full bg-cyan-300"></div>
					</div>

					<p>
						{tLayout.sync_dialog.description.warning()}
					</p>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if $errorDialogOpen && error instanceof ErrDemoDBNotInitialised}
	<!-- Demo DB initialization dialog - only shown in demo mode when DB needs to be fetched -->
	<div use:melt={$errorDialogPortalled}>
		<div use:melt={$errorDialogOverlay} class="fixed inset-0 z-[100] bg-black/50" transition:fade|global={{ duration: 150 }}></div>

		<div
			class="fixed left-1/2 top-1/2 z-[200] max-h-screen w-full translate-x-[-50%] translate-y-[-50%] overflow-y-auto px-4 md:max-w-md md:px-0"
			transition:fade={{ duration: 250 }}
			use:melt={$errorDialogContent}
		>
			<div class="modal-box overflow-clip rounded-lg md:shadow-2xl">
				<h2 use:melt={$errorDialogTitle} class="mb-4 text-xl font-semibold leading-7 text-gray-900">
					{tLayout.error_dialog.demo_db_not_initialised.title()}
				</h2>

				<p class="mb-4 text-sm leading-6 text-gray-600" use:melt={$errorDialogDescription}>
					<span class="mb-2 block">
						{tLayout.error_dialog.demo_db_not_initialised.call_to_action()}
					</span>
					<span class="mb-2 block">
						{tLayout.error_dialog.demo_db_not_initialised.description()}
					</span>
				</p>

				<div class="mb-8 h-3 w-full overflow-hidden rounded">
					<div use:progressBar={demoFetchProgress} class="h-full bg-cyan-300"></div>
				</div>

				<div class="w-full text-end">
					<button on:click={handleFetchDemoDB} type="button" class="btn-secondary btn">
						{tLayout.error_dialog.demo_db_not_initialised.button()}
					</button>
				</div>
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
	@media print {
		#mobile-nav-trigger {
			display: none;
		}
	}
</style>
