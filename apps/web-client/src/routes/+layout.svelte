<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";

	import { onMount } from "svelte";
	import { Subscription } from "rxjs";
	import { pwaInfo } from "virtual:pwa-info";

	import type { LayoutData } from "./$types";

	import { IS_E2E } from "$lib/constants";

	import { Toast } from "$lib/components";

	import { defaultToaster } from "$lib/toasts";
	import { settingsStore } from "$lib/stores";

	export let data: LayoutData;

	const { db } = data;

	// We're using this to disabla notifications for during e2e tests.
	// In production this will always be true
	//
	// TODO: Maybe move the toasts somewhere else on the screen as they're obscuring
	// the dashboard for tests as well as for the user clicking through.
	let showNotifications = !IS_E2E;

	let availabilitySubscription: Subscription;

	$: db?.setLabelPrinterUrl($settingsStore.labelPrinterUrl);
	$: db?.setReceiptPrinterUrl($settingsStore.receiptPrinterUrl);

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

	export function onDestroy() {
		availabilitySubscription && availabilitySubscription.unsubscribe();
	}

	$: webManifest = pwaInfo ? pwaInfo.webManifest.linkTag : "";
</script>

<svelte:head>
	{@html webManifest}
</svelte:head>

<slot />

{#if showNotifications}
	<div class="fixed bottom-12 right-4 z-[100] md:top-20 md:bottom-auto">
		<div class="flex flex-col gap-y-6">
			{#each $defaultToaster as toast (toast.id)}
				<Toast {toast} />
			{/each}
		</div>
	</div>
{/if}

<style global>
	:global(body) {
		height: 100%;
		padding: 0;
		margin: 0;
		overflow-y: hidden;
	}
</style>
