<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";
	import "./global.css";

	import { onMount } from "svelte";
	import { Subscription } from "rxjs";
	import { pwaInfo } from "virtual:pwa-info";
	import { browser } from "$app/environment";

	import type { LayoutData } from "./$types";

	import { IS_DEBUG, IS_E2E } from "$lib/constants";

	import * as books from "$lib/db/cr-sqlite/books";
	import * as customers from "$lib/db/cr-sqlite/customers";
	import * as note from "$lib/db/cr-sqlite/note";
	import * as reconciliation from "$lib/db/cr-sqlite/order-reconciliation";
	import * as suppliers from "$lib/db/cr-sqlite/suppliers";
	import * as warehouse from "$lib/db/cr-sqlite/warehouse";

	export let data: LayoutData & { status: boolean };

	const { dbCtx } = data;

	import { afterNavigate } from "$app/navigation";

	afterNavigate((nav) => {
		// Painful workaround: for some reasons sometimes navigating to a different route
		// yields a blank page. This is the lamest of possible workarounds
		const minimumDivs = 10; // Magic number empirically chosen: if there are at least 10 divs the
		// page did render
		if (document.getElementsByTagName("div").length < minimumDivs) {
			// eslint-disable-next-line no-self-assign
			location.href = location.href;
		}
	});

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
		}

		// This shouldn't affect much, but is here for the purpose of exhaustive handling
		if (browser && !dbCtx) {
			window["db_ready"] = false;
			window["_db"] = undefined;
		}
	}

	let availabilitySubscription: Subscription;

	onMount(async () => {
		// TODO: revisit
		// if (!status) {
		// 	await goto(appPath("settings"));
		// }

		if (pwaInfo) {
			const { registerSW } = await import("virtual:pwa-register");
			registerSW({
				immediate: true,
				onRegistered(r) {
					if (r) {
						setInterval(() => {
							r.update();
						}, 20000);
					}
				},
				onRegisterError() {
					/**
					 * @TODO maybe display a toast
					 */
				}
			});
		}
	});

	export function onDestroy() {
		if (availabilitySubscription) {
			availabilitySubscription.unsubscribe();
		}
	}

	$: webManifest = pwaInfo ? pwaInfo.webManifest.linkTag : "";
</script>

<svelte:head>
	{@html webManifest}
</svelte:head>

<slot />
