<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";
	import "./global.css";

	import { onDestroy, onMount } from "svelte";
	import { get } from "svelte/store";
	import { WorkerInterface } from "@vlcn.io/ws-client";
	import { Subscription } from "rxjs";
	import { browser } from "$app/environment";

	import type { LayoutData } from "./$types";

	import { IS_DEBUG, IS_E2E } from "$lib/constants";
	import SyncWorker from "$lib/workers/sync-worker.ts?worker";
	import { sync, syncConfig, syncActive } from "$lib/db";

	import * as books from "$lib/db/cr-sqlite/books";
	import * as customers from "$lib/db/cr-sqlite/customers";
	import * as note from "$lib/db/cr-sqlite/note";
	import * as reconciliation from "$lib/db/cr-sqlite/order-reconciliation";
	import * as suppliers from "$lib/db/cr-sqlite/suppliers";
	import * as warehouse from "$lib/db/cr-sqlite/warehouse";

	export let data: LayoutData & { status: boolean };

	const { dbCtx } = data;

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

	// #region sync

	// Update sync on each change to settings
	//
	// NOTE: This is safe even on server side as it will be a noop until
	// the worker is initialized
	$: $syncActive ? sync.sync($syncConfig) : sync.stop();

	onMount(() => {
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
	});

	// #endregion sync

	onMount(async () => {
		// This helps us in e2e to know when the page is interactive, otherwise Playwright will start too early
		document.body.setAttribute("hydrated", "true");

		// TODO: revisit
		// if (!status) {
		// 	await goto(appPath("settings"));
		// }
	});

	onDestroy(() => {
		availabilitySubscription && availabilitySubscription.unsubscribe();
	});
</script>

<svelte:head></svelte:head>

<slot />
