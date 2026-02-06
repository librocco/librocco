<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";
	import "./global.css";

	import { onMount, onDestroy } from "svelte";
	import { get, writable, derived } from "svelte/store";
	import { fade, fly } from "svelte/transition";
	import { createDialog, melt } from "@melt-ui/svelte";
	import { Subscription } from "rxjs";

	import Menu from "$lucide/menu";

	import { afterNavigate } from "$app/navigation";
	import { beforeNavigate } from "$app/navigation";

	import { app, nukeAndResyncDb } from "$lib/app";
	import { AppDbState, getDb, getDbRx, getVfs } from "$lib/app/db";

	import type { LayoutData } from "./$types";

	import { DEMO_DB_NAME, DEMO_DB_URL, IS_DEBUG, IS_DEMO, IS_E2E } from "$lib/constants";

	import { Sidebar } from "$lib/components";

	import { ErrDemoDBNotInitialised } from "$lib/db/cr-sqlite/errors";
	import * as stockCache from "$lib/db/cr-sqlite/stock_cache";
	import { timeLogger } from "$lib/utils/timer";
	import { syncConnectivityMonitor, updateSyncConnectivityMonitor, resetSyncStuckState } from "$lib/stores";
	import { applyHandshakeStatus, resetSyncCompatibility, syncCompatibility } from "$lib/stores/sync-compatibility";
	import { attachPendingMonitor, resetPendingTracker, setLastAckedVersion } from "$lib/stores/sync-pending";

	import { default as Toaster, toastError } from "$lib/components/Melt/Toaster.svelte";

	import { LL } from "@librocco/shared/i18n-svelte";
	import { deleteDBFromOPFS, fetchAndStoreDBFile } from "$lib/db/cr-sqlite/core/utils";

	import { progressBar } from "$lib/actions";

	import { appPath } from "$lib/paths";
	import { initializeSync, startSync, stopSync } from "$lib/app/sync";

	export let data: LayoutData;

	const dbState = app.db.state;

	// Very TEMP, replace this with cleaner error handling
	let error = null;
	const errorStore = derived([dbState], ([s$]) => (s$ === AppDbState.Error ? app.db.error : null));
	$: error = $errorStore;

	// TODO: revisit this and agree on convergence:
	// - should we revert back to string states?
	// - should we move the full app-splash control to the app (why direct HTML insert)?
	// - leave this as is (pretty dirty)?
	const signalDbInitState = (state: AppDbState, error?: Error) => {
		const phase = ["idle", "error", "loading", "migrating", "ready"][state];
		window["__dbInitUpdate"]?.(phase, error || null);
	};
	$: signalDbInitState($dbState, app.db.error);

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

	// Signal (to Playwright) that the DB is initialised
	onMount(async () => {
		await getDb(app);
		window["db_ready"] = true;
		window.dispatchEvent(new Event("db_ready"));
	});

	let availabilitySubscription: Subscription;
	let detachPendingMonitor: (() => void) | null = null;
	let detachPendingInvalidate: (() => void) | null = null;
	let detachSyncStatus: (() => void) | null = null;

	// Config stores
	const dbid = app.config.dbid;
	const syncUrl = app.config.syncUrl;
	const syncActive = app.config.syncActive;

	// Update sync on each change to settings
	//
	// NOTE: This is safe with respect to initialisation as it runs only if DB ready
	// const dbReady = app.db.ready;
	//
	// TODO: wrap this is a connector function
	$: if ($syncActive) {
		startSync(app, $dbid, $syncUrl);
	}
	$: if (!$syncActive) {
		stopSync(app);
	}

	// Sync
	// NOTE: using a merged store for initial / ongoing sync -- we may or may not want to split these two
	const syncProgress = derived([app.sync.initialSyncProgressStore, app.sync.syncProgressStore], ([a, b]) => (a.active ? a : b));

	// TODO: wrap these to ensure both are initialised only once -- removing the need for
	// onDestroy calls (as this is the root layout)
	const preventUnloadHandler = (e: BeforeUnloadEvent) => {
		if (get(syncProgress).active) {
			e.preventDefault();
			e.returnValue = "";
		}
	};
	let disposer: () => void;

	onMount(async () => {
		// This helps us in e2e to know when the page is interactive
		document.body.setAttribute("hydrated", "true");

		// Control the invalidation of the stock cache
		// On every 'book_transaction' change, we run 'maybeInvalidate', which checks for relevant changes
		// between the last cached value and the current one and invalidates the cache if needed
		disposer = getDbRx(app).onRange(["book_transaction"], async () => stockCache.maybeInvalidate(await getDb(app)));

		// Prevent user from navigating away if sync is in progress
		// NOTE: this is a noop if sync not active (e.g. in demo mode)
		window.addEventListener("beforeunload", preventUnloadHandler);

		const currentDb = await getDb(app);
		detachPendingMonitor = await attachPendingMonitor(currentDb, getDbRx(app), get(dbid));
		detachPendingInvalidate = getDbRx(app).onInvalidate(async () => {
			detachPendingMonitor?.();
			if (app.db.db && app.db.dbid) {
				detachPendingMonitor = await attachPendingMonitor(app.db.db, getDbRx(app), app.db.dbid);
			}
		});
		detachSyncStatus = await app.sync.runExclusive(async (sync) => {
			return sync.worker.onSyncStatus((payload) => {
				applyHandshakeStatus(get(dbid), payload);
				if (payload.ackDbVersion != null) {
					void setLastAckedVersion(payload.ackDbVersion, get(dbid));
				}
			});
		});
	});

	onDestroy(() => {
		// Run all cleanup functions
		availabilitySubscription?.unsubscribe();
		disposer?.();
		window.removeEventListener("beforeunload", preventUnloadHandler);
		detachPendingMonitor?.();
		detachPendingInvalidate?.();
		detachSyncStatus?.();
		resetPendingTracker();
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
				syncDialogOpen.set(true);
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

	$: $errorDialogOpen = Boolean($dbState === AppDbState.Error);

	// Sync stuck dialog
	const {
		elements: {
			overlay: syncStuckDialogOverlay,
			content: syncStuckDialogContent,
			portalled: syncStuckDialogPortalled,
			title: syncStuckDialogTitle,
			description: syncStuckDialogDescription
		},
		states: { open: syncStuckDialogOpen }
	} = createDialog({
		forceVisible: true
	});

	// Show sync stuck dialog when sync is stuck and sync is supposed to be active
	const syncStuck = syncConnectivityMonitor.stuck;
	const syncDiagnostics = syncConnectivityMonitor.diagnostics;
	const syncCompatibilityState = syncCompatibility;
	let isIncompatible = false;
	$: isIncompatible = $syncCompatibilityState.status === "incompatible";
	$: $syncStuckDialogOpen = ($syncStuck || isIncompatible) && $syncActive;

	const handleNukeAndResync = async () => {
		syncStuckDialogOpen.set(false);
		resetSyncStuckState();
		resetSyncCompatibility($dbid);
		await nukeAndResyncDb(app, $dbid, getVfs(app));
	};

	$: ({ layout: tLayout, common: tCommon } = $LL);

	// DEMO
	const demoFetchProgress = writable({ active: false, nProcessed: 0, nTotal: 0 });

	const handleFetchDemoDB = async () => {
		// Sanity check: this should be unreachable as we validate the DEMO_DB_URL at build time
		if (!DEMO_DB_URL) {
			throw new Error("DEMO_DB_URL is not set");
		}

		// NOTE: noop if not exists
		await deleteDBFromOPFS(DEMO_DB_NAME);

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

{#if $syncStuckDialogOpen}
	<!-- Sync stuck dialog - shown when sync connection repeatedly fails -->
	<div use:melt={$syncStuckDialogPortalled}>
		<div use:melt={$syncStuckDialogOverlay} class="fixed inset-0 z-[100] bg-black/50" transition:fade|global={{ duration: 150 }}></div>

		<div
			class="fixed left-1/2 top-1/2 z-[200] max-h-screen w-full translate-x-[-50%] translate-y-[-50%] overflow-y-auto px-4 md:max-w-md md:px-0"
			transition:fade={{ duration: 250 }}
			use:melt={$syncStuckDialogContent}
		>
			<div class="modal-box overflow-clip rounded-lg md:shadow-2xl">
				<h2 use:melt={$syncStuckDialogTitle} class="mb-4 text-xl font-semibold leading-7 text-gray-900">
					{tLayout.error_dialog.sync_stuck.title()}
				</h2>

				<p class="mb-4 text-sm leading-6 text-gray-600" use:melt={$syncStuckDialogDescription}>
					<span class="mb-2 block">
						{tLayout.error_dialog.sync_stuck.description()}
					</span>
					<span class="mb-2 block">
						{isIncompatible ? tLayout.error_dialog.sync_stuck.call_to_action() : tLayout.error_dialog.sync_stuck.call_to_action()}
					</span>
				</p>

				<!-- Diagnostic details -->
				{#if isIncompatible}
					<div class="mb-4 rounded bg-base-200 p-3 font-mono text-xs">
						{#if $syncCompatibilityState.status === "incompatible" && $syncCompatibilityState.reason === "local_db_error"}
							<p class="mb-1 font-semibold text-error">Local database error</p>
							<p class="text-gray-600">
								{$syncCompatibilityState.message || "The local database is corrupted or inaccessible."}
							</p>
							<p class="mt-2 text-gray-500">
								Your local database needs to be reset. This will download a fresh copy from the server.
							</p>
						{:else}
							<p class="mb-1 font-semibold text-gray-700">Remote DB incompatible</p>
							<p class="text-gray-600">
								{#if $syncCompatibilityState.status === "incompatible"}
									{$syncCompatibilityState.message || "The remote database changed identity. Please resync."}
								{:else}
									Remote database not compatible.
								{/if}
							</p>
						{/if}
					</div>
				{/if}
				{#if $syncDiagnostics.reason}
					<div class="mb-4 rounded bg-base-200 p-3 font-mono text-xs">
						<p class="mb-1 font-semibold text-gray-700">{tLayout.error_dialog.sync_stuck.diagnostics.title()}</p>
						{#if $syncDiagnostics.reason === "rapid_closes"}
							<p class="text-gray-600">
								{tLayout.error_dialog.sync_stuck.diagnostics.rapid_closes({ count: $syncDiagnostics.rapidCloseCount })}
							</p>
						{:else if $syncDiagnostics.reason === "timeout"}
							<p class="text-gray-600">{tLayout.error_dialog.sync_stuck.diagnostics.timeout()}</p>
						{:else if $syncDiagnostics.reason === "repeated_disconnects"}
							<p class="text-gray-600">
								{tLayout.error_dialog.sync_stuck.diagnostics.repeated_disconnects({ count: $syncDiagnostics.disconnectCount })}
							</p>
						{/if}
						<p class="mt-1 text-gray-500">{tLayout.error_dialog.sync_stuck.diagnostics.hint()}</p>
					</div>
				{/if}

				<div class="flex w-full justify-end gap-x-2">
					<button on:click={() => syncStuckDialogOpen.set(false)} type="button" class="btn-ghost btn">
						{tCommon.actions.cancel()}
					</button>
					<button on:click={handleNukeAndResync} type="button" class="btn-primary btn">
						{tLayout.error_dialog.sync_stuck.button()}
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
