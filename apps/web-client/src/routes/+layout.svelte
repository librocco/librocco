<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";
	import "./global.css";

	import { onMount } from "svelte";
	import { Subscription } from "rxjs";
	import { pwaInfo } from "virtual:pwa-info";

	import type { LayoutData } from "./$types";
	import { browser } from "$app/environment";

	export let data: LayoutData & { status: boolean };

	const { dbCtx } = data;

	import { afterNavigate } from "$app/navigation";

	afterNavigate((nav) => {
		// Painful workaround: for some reasons sometimes navigating to a different route
		// yields a blank page. This is the lamest of possible workarounds
		const minimumDivs = 10; // Magic number empirically chosen: if there are at least 10 divs the
		// page did render
		if (document.getElementsByTagName("div").length < minimumDivs) {
			location.href = location.href; // Full reload
		}
	});

	$: if (browser) {
		if (dbCtx) {
			// Register (and update on each change) the db to the window object.
			// This is used for e2e tests (easier setup through direct access to the db).
			// This is not a security concern as the db is in the user's browser anyhow.
			window["db_ready"] = true;
			window["_db"] = dbCtx.db;
			window.dispatchEvent(new Event("db_ready"));
		} else {
			// This shouldn't affect much, but is here for the purpose of exhaustive handling
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
