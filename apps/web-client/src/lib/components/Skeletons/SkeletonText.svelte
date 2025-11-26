<script lang="ts">
	import SkeletonBase from "./SkeletonBase.svelte";

	export let lines: number = 3;
	export let spacing: string = "gap-y-2";
</script>

<div class="flex flex-col {spacing}">
	{#each Array(lines) as _, i}
		<SkeletonBase width={i === lines - 1 ? "75%" : "100%"} height="1rem" />
	{/each}
</div>
