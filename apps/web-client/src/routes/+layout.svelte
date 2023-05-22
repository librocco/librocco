<script lang="ts">
	import { onMount } from "svelte";

	// Import main.css in order to generate tailwind classes used in the app
	import "../main.css";

	// onMount(async () => {
	// 	// not all browsers support sw
	// 	if ("serviceWorker" in navigator) {
	// 		navigator.serviceWorker
	// 			// .register("/preview/static-sw.js")
	// 			.register("/preview/built-sw.js")
	// 			.then(() => console.log("success"))
	// 			.catch((err) => console.log("not success", err));
	// 	}
	// });
	
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
