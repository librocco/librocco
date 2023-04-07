<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";

	import ProgressBar from "./ProgressBar.svelte";

	export let Hst: Hst;

	let values = [0, 0.25, 0.5, 0.75, 1];
</script>

<Hst.Story title="ProgressBar">
	{#each values as value}
		<h1>{value * 100}%</h1>
		<ProgressBar class="my-8 mx-2" {value} />
	{/each}
	<h1>Unknown</h1>
	<ProgressBar class="my-8 mx-2" />
</Hst.Story>
