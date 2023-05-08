<script lang="ts">
	import { onMount } from "svelte";

	// Import main.css in order to generate tailwind classes used in the app
	import "../main.css";
	import { registerSW } from "virtual:pwa-register";

	onMount(async () => {
		if('serviceWorker' in navigator){
			registerSW()
		}
	})
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
