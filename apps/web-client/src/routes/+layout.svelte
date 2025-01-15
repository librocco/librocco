<!-- src/routes/+layout.svelte -->
<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";
	import { onMount, onDestroy } from "svelte";
	import { Subscription } from "rxjs";

	// Pull out PWA info to inject web manifest
	import { pwaInfo } from "virtual:pwa-info";

	import { browser } from "$app/environment";
	import { goto } from "$lib/utils/navigation";
	import { appPath } from "$lib/paths";

	// This is the recommended store for Svelte
	import { useRegisterSW } from "virtual:pwa-register/svelte";

	// Layout data
	import type { LayoutData } from "./$types";
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
		} else if (browser && !db) {
			// This shouldn't affect much, but is here for the purpose of exhaustive handling
			window["db_ready"] = false;
			window["_db"] = undefined;
		}
	}

	let availabilitySubscription: Subscription;

	onDestroy(() => {
		availabilitySubscription && availabilitySubscription.unsubscribe();
	});

	/**
	 * Service Worker Registration
	 */
	// The 'useRegisterSW' store gives you reactivity for offline and updates
	let needRefresh, offlineReady, updateServiceWorker;
	if (browser) {
		const sw = useRegisterSW({
			// If true, the SW will register as soon as this runs, rather than waiting.
			immediate: true,
			onRegistered(r) {
				// Optionally check for updates, e.g. every 20s (often overkill in prod).
				// r && setInterval(() => r.update(), 20000);
				console.log("Service Worker registered!", r);
			},
			onRegisterError(error) {
				console.error("Service Worker registration error:", error);
			}
		});
		needRefresh = sw.needRefresh;
		offlineReady = sw.offlineReady;
		updateServiceWorker = sw.updateServiceWorker;
	}

	// Insert link tag for the web manifest
	$: webManifest = pwaInfo ? pwaInfo.webManifest.linkTag : "";
</script>

<svelte:head>
	<!-- Inject the web manifest link -->
	{@html webManifest}
</svelte:head>

<!-- Your layout content -->
<slot />

<!--
  Simple example toast-like prompt for SW events:
  - If offlineReady is true, the app is now cached and ready for offline usage.
  - If needRefresh is true, we have a new version available.
-->
{#if $needRefresh || $offlineReady}
	<div class="pwa-toast" role="alert">
		{#if $offlineReady}
			<p>The app is ready to work offline.</p>
		{:else}
			<p>
				New content available!
				<button on:click={() => updateServiceWorker(true)}> Refresh </button>
			</p>
		{/if}
	</div>
{/if}

<style global>
	:global(body) {
		height: 100%;
		margin: 0;
		padding: 0;
		/* Overflows, etc., are up to you; just an example: */
		overflow-y: hidden;
	}
	.pwa-toast {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		background: white;
		border: 1px solid #ccc;
		padding: 1rem;
		z-index: 9999;
		border-radius: 4px;
	}
</style>
