<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";
	import { onMount } from "svelte";
	import { pwaInfo } from "virtual:pwa-info";

	import { Toast } from "@librocco/ui";

	import { defaultToaster, toastReplicationStatus } from "$lib/toasts";
	import { remoteDbStore } from "$lib/stores";

	import type { LayoutData } from "./$types";

	// We toast here because we want replication state to be communicated wherever we are in the app
	$: ({ replicator } = remoteDbStore);
	$: ({ status } = replicator);
	$: {
		if ($status) {
			toastReplicationStatus($status.state);
		}
	}

	export let data: LayoutData;

	const { db } = data;

	onMount(async () => {
		// Register the db to the window object.
		// This is used for e2e tests (easier setup through direct access to the db).
		// This is not a security concern as the db is in the user's browser anyhow.
		if (db) {
			window["_db"] = db;
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

	$: webManifest = pwaInfo ? pwaInfo.webManifest.linkTag : "";
</script>

<svelte:head>
	{@html webManifest}
</svelte:head>

<slot />

<!--Toasts container-->
<div class="fixed bottom-12 right-4 z-[100] md:top-20 md:bottom-auto">
	<div class="flex flex-col gap-y-6">
		{#each $defaultToaster as toast (toast.id)}
			<Toast {toast} />
		{/each}
	</div>
</div>

<style global>
	:global(body) {
		height: 100%;
		padding: 0;
		margin: 0;
		overflow-y: hidden;
	}
</style>
