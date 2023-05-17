<script lang="ts">
	import { onMount } from "svelte";

	// Import main.css in order to generate tailwind classes used in the app
	import "../main.css";

	onMount(async () => {
		console.log(window.location.origin);
		if ("serviceWorker" in navigator) {
			navigator.serviceWorker
				.register("/my-sw.js", { scope: "/" })
				.then(() => {
					console.log("success");
				})
				.catch((err) => {
					console.log("not success", err);
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
