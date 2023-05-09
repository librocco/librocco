<script lang="ts">
	import { onMount } from "svelte";

	// Import main.css in order to generate tailwind classes used in the app
	import "../main.css";
	import { pwaInfo } from "virtual:pwa-info";

	onMount(async () => {
		if (pwaInfo) {
			const { registerSW } = await import("virtual:pwa-register");
			registerSW({
				onRegistered(r) {
					// uncomment following code if you want check for updates
					// r && setInterval(() => {
					//    console.log('Checking for sw update')
					//    r.update()
					// }, 20000 /* 20s for testing purposes */)
					console.log(`SW Registered: ${r}`);
				},
				onRegisterError(error) {
					console.log("SW registration error", error);
				}
			});
		}
	});
</script>

<slot />

<style global>
	:global(body) {
		height: 100%;
		padding: 0;
		margin: 0;
		overflow-y: hidden;
	}
</style>
