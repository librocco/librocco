<script lang="ts">
	import SkeletonCard from "./SkeletonCard.svelte";

	export let items: number = 3;
	export let hasActions: boolean = true;
</script>

<div class="entity-list-container">
	{#each Array(items) as _}
		<SkeletonCard {hasActions} />
	{/each}
</div>
