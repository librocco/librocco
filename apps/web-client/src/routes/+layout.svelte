<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "../main.css";
	import { onMount } from "svelte";
	import { pwaInfo } from "virtual:pwa-info";

	onMount(async () => {
		if (pwaInfo) {
			console.log({ pwaInfo });

			const { registerSW } = await import("virtual:pwa-register");
			registerSW({
				immediate: true,
				onRegistered(r) {
					r &&
						setInterval(() => {
							console.log("Checking for sw update");
							r.update();
						}, 20000);
					console.log(`SW Registered: ${r}`);
				},
				onRegisterError(error) {
					console.log("SW registration error", error);
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

<style global>
	:global(body) {
		height: 100%;
		padding: 0;
		margin: 0;
		overflow-y: hidden;
	}
</style>
