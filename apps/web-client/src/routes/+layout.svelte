<script lang="ts">
	// Import main.css in order to generate tailwind classes used in the app
	import "../main.css";
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
