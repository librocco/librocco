<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "$lib/main.css";

	import { onMount } from "svelte";
	import { Subscription } from "rxjs";
	import { createDialog, melt } from "@melt-ui/svelte";
	import { pwaInfo } from "virtual:pwa-info";

	import { Toast, Dialog } from "$lib/components";

	import { IS_E2E } from "$lib/constants";

	import { defaultToaster } from "$lib/toasts";

	import type { LayoutData } from "./$types";
	import { settingsStore } from "$lib/stores";
	import { goto } from "$app/navigation";
	import { base } from "$app/paths";

	export let data: LayoutData;

	const { db } = data;

	// We're using this to disabla notifications for during e2e tests.
	// In production this will always be true
	//
	// TODO: Maybe move the toasts somewhere else on the screen as they're obscuring
	// the dashboard for tests as well as for the user clicking through.
	let showNotifications = !IS_E2E;

	let availabilitySubscription: Subscription;

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

	const dialog = createDialog({
		forceVisible: true
	});

	const {
		elements: { overlay, portalled },
	} = dialog;
</script>

<svelte:head>
	{@html webManifest}
</svelte:head>

{#if db}
	<slot />
{:else}
	<div use:melt={$portalled}>
		<div use:melt={$overlay} class="fixed inset-0 z-50 bg-gray-900" />
			<div class="fixed left-[50%] top-[50%] z-50 flex max-w-2xl translate-x-[-50%] translate-y-[-50%]">
				<Dialog {dialog} type="delete" onConfirm={() => {}}>
					{console.log($settingsStore)}
					<svelte:fragment slot="title">No database found at {$settingsStore.couchUrl}</svelte:fragment>
					<svelte:fragment slot="description">You can either retry the connection or check the provided url</svelte:fragment>
					<button slot="secondary-button" class="button button-sm button-alert" on:click={() => goto(`${base}/settings/`)}>
						Go to settings
					</button>
					<button slot="confirm-button" class="button button-sm button-green">
						Retry
					</button>
				</Dialog>
			</div>
	</div>
{/if}

<!--Toasts container-->
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
