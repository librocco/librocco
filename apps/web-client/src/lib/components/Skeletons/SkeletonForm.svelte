<script lang="ts">
	import SkeletonBase from "./SkeletonBase.svelte";

	export let fields: number = 5;
</script>

<div class="flex flex-col gap-y-4">
	{#each Array(fields) as _}
		<div class="flex flex-col gap-y-2">
			<SkeletonBase width="8rem" height="1rem" />
			<SkeletonBase height="2.5rem" rounded="rounded-lg" />
		</div>
	{/each}

	<div class="mt-4 flex gap-2">
		<SkeletonBase width="5rem" height="2.5rem" rounded="rounded-md" />
		<SkeletonBase width="5rem" height="2.5rem" rounded="rounded-md" />
	</div>
</div>
