<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";

	import { onMount } from "svelte";
	import { Subscription } from "rxjs";
	import { pwaInfo } from "virtual:pwa-info";

	import type { LayoutData } from "./$types";
	import { goto } from "$lib/utils/navigation";
	import { appPath } from "$lib/paths";
	import { browser } from "$app/environment";

	// #region temp
	import SyncWorker from "$lib/db/orders/__tests__/worker.js?worker";
	import { getInitializedDB } from "$lib/db/orders/db";
	import * as local from "$lib/db/orders/customers";
	import * as remote from "$lib/db/orders/customers-remote";
	import { WorkerInterface } from "ws-client-fork";
	import tblrx from "@vlcn.io/rx-tbl";

	export let data: LayoutData & { status: boolean };

	const { db, status } = data;

	$: {
		// Register (and update on each change) the db to the window object.
		// This is used for e2e tests (easier setup through direct access to the db).
		// This is not a security concern as the db is in the user's browser anyhow.
		if (browser && db) {
			window["db_ready"] = true;
			window["_db"] = db;
			window.dispatchEvent(new Event("db_ready"));
		}
		// This shouldn't affect much, but is here for the purpose of exhaustive handling
		if (browser && !db) {
			window["db_ready"] = false;
			window["_db"] = undefined;
		}
	}

	let availabilitySubscription: Subscription;

	onMount(async () => {
		if (!status) {
			await goto(appPath("settings"));
		}

		if (pwaInfo) {
			const { registerSW } = await import("virtual:pwa-register");
			registerSW({
				immediate: true,
				onRegistered(r) {
					r &&
						setInterval(() => {
							r.update();
						}, 20000);
				},
				onRegisterError() {
					/**
					 * @TODO maybe display a toast
					 */
				}
			});
		}

		const sw = new SyncWorker();

		window["tblrx"] = tblrx;
		window["wkr"] = new WorkerInterface(sw);
		window["getInitializedDB"] = getInitializedDB;
		window["local"] = local;
		window["remote"] = remote;
	});

	export function onDestroy() {
		availabilitySubscription && availabilitySubscription.unsubscribe();
	}

	$: webManifest = pwaInfo ? pwaInfo.webManifest.linkTag : "";
</script>

<svelte:head>
	{@html webManifest}
</svelte:head>

<slot />

<style global>
	:global(body) {
		height: 100%;
		padding: 0;
		margin: 0;
		overflow-y: hidden;
	}
</style>
