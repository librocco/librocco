<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";

	import { onMount } from "svelte";
	import { Subscription } from "rxjs";
	import { pwaInfo } from "virtual:pwa-info";

	import type { LayoutData } from "./$types";
	import { goto } from "$lib/utils/navigation";
	import { appPath } from "$lib/paths";

	export let data: LayoutData & { status: boolean };

	const { db, status } = data;

	let availabilitySubscription: Subscription;

	onMount(async () => {
		// Register the db to the window object.
		// This is used for e2e tests (easier setup through direct access to the db).
		// This is not a security concern as the db is in the user's browser anyhow.
		if (!status) {
			await goto(appPath("settings"));
		}
		if (db) {
			window["db_ready"] = true;
			window["_db"] = db;
			window.dispatchEvent(new Event("db_ready"));
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
