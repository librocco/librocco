<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import ProgressBar from "./ProgressBar.svelte";

	export const meta: Meta = {
		title: "Progress bar",
		component: ProgressBar
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";

	const values = [0, 0.25, 0.5, 0.75, 1];
</script>

<Story name="Default">
	{#each values as value}
		<h1>{value * 100}%</h1>
		<ProgressBar class="my-8 mx-2" {value} />
	{/each}
	<h1>Unknown</h1>
	<ProgressBar class="my-8 mx-2" />
</Story>
