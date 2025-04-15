<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";
	import "./global.css";

	import { onDestroy, onMount } from "svelte";
	import { get } from "svelte/store";
	import { fade, fly } from "svelte/transition";

	import { WorkerInterface } from "@vlcn.io/ws-client";
	import { Subscription } from "rxjs";
	import { createDialog, melt } from "@melt-ui/svelte";
	import { Menu } from "lucide-svelte";

	import { afterNavigate } from "$app/navigation";
	import { browser } from "$app/environment";

	import { Sidebar } from "$lib/components";

	import { IS_DEBUG, IS_E2E } from "$lib/constants";
	import { sync, syncConfig, syncActive } from "$lib/db";
	import SyncWorker from "$lib/workers/sync-worker.ts?worker";

	import * as books from "$lib/db/cr-sqlite/books";
	import * as customers from "$lib/db/cr-sqlite/customers";
	import * as note from "$lib/db/cr-sqlite/note";
	import * as reconciliation from "$lib/db/cr-sqlite/order-reconciliation";
	import * as suppliers from "$lib/db/cr-sqlite/suppliers";
	import * as warehouse from "$lib/db/cr-sqlite/warehouse";
	import { timeLogger } from "$lib/utils/timer";
	import { beforeNavigate } from "$app/navigation";

	import type { LayoutData } from "./$types";

	export let data: LayoutData;

	const { dbCtx } = data;

	// beforeNavigate(({ to }) => {
	// 	timeLogger.setCurrentRoute(to.route.id);
	// });

	$: {
		// Register (and update on each change) the db and some db handlers to the window object.
		// This is used for e2e tests (easier setup through direct access to the db).
		// Additionally, we're doing this in debug mode - in case we want to interact with the DB directly (using dev console)
		if (browser && dbCtx && (IS_E2E || IS_DEBUG)) {
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

	onMount(() => {
		// This helps us in e2e to know when the page is interactive, otherwise Playwright will start too early
		document.body.setAttribute("hydrated", "true");

		window["timeLogger"] = timeLogger;

		// Start the sync worker
		//
		// Init worker and sync interface
		const wkr = new WorkerInterface(new SyncWorker());
		sync.init(wkr);

		// Start the sync
		if (get(syncActive)) {
			sync.sync(get(syncConfig));
		}
	});

	onDestroy(() => {
		sync.stop(); // Safe and idempotent

		availabilitySubscription?.unsubscribe();
	});

	const {
		elements: { trigger, overlay, content, portalled, title, description },
		states: { open: mobileNavOpen }
	} = createDialog({
		forceVisible: true
	});

	afterNavigate(() => {
		if ($mobileNavOpen) {
			$mobileNavOpen = false;
		}
	});
</script>

<div class="bg-base-200 lg:divide-base-content flex h-full lg:divide-x">
	<div class="hidden h-full w-72 lg:block">
		<Sidebar />
	</div>

	<!-- flex flex-1 flex-col justify-items-center overflow-y-auto -->
	<main class="h-full w-full overflow-y-auto">
		{#if !$mobileNavOpen}
			<!--TODO:  add aria-label to dict-->
			<button use:melt={$trigger} class="btn-ghost btn-square btn fixed left-3 top-2 z-[200] lg:hidden">
				<Menu size={24} aria-hidden />
			</button>
		{/if}

		<slot />
	</main>
</div>

{#if $mobileNavOpen}
	<div use:melt={$portalled}>
		<div use:melt={$overlay} class="fixed inset-0 z-[100] bg-black/50" transition:fade|global={{ duration: 150 }}></div>

		<div
			use:melt={$content}
			class="bg-base-200 fixed bottom-0 left-0 top-0 z-[200] h-full w-2/3 max-w-md overflow-y-auto"
			transition:fly|global={{
				x: -350,
				duration: 300,
				opacity: 1
			}}
		>
			<h2 class="sr-only" use:melt={$title}>
				<!-- TODO: add dialog title to dict-->
			</h2>

			<p class="sr-only" use:melt={$description}>
				<!-- TODO: add dialog description to dict -->
			</p>
			<Sidebar />
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
