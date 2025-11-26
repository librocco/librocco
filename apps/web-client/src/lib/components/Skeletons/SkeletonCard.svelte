<script lang="ts">
	import SkeletonBase from "./SkeletonBase.svelte";

	export let hasActions: boolean = true;
</script>

<div class="entity-list-row">
	<div class="flex flex-1 flex-col gap-y-2 self-start">
		<SkeletonBase width="40%" height="1.5rem" />
		<div class="flex flex-row gap-x-8">
			<SkeletonBase width="6rem" height="1rem" />
			<SkeletonBase width="6rem" height="1rem" />
		</div>
	</div>
	{#if hasActions}
		<div class="entity-list-actions">
			<SkeletonBase width="8rem" height="2.5rem" rounded="rounded-lg" />
		</div>
	{/if}
</div>
