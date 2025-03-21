<script lang="ts">
	import { createEventDispatcher } from "svelte";

	export let deliveredBookCount: number;
	export let rejectedBookCount: number;

	const dispatch = createEventDispatcher<{
		confirm: void;
		cancel: void;
	}>();
</script>

<div class="prose flex max-w-none flex-col gap-y-2 p-6">
	<h3>Finalize reconciliation order</h3>
	{#if deliveredBookCount > 0}
		<p>{deliveredBookCount} books will be marked as delivered (and ready to be collected)</p>
	{/if}

	{#if rejectedBookCount > 0}
		<p>{rejectedBookCount} books will be marked as rejected (waiting for reordering)</p>
	{/if}

	<div class="stretch flex w-full gap-x-4">
		<div class="basis-fit">
			<button on:click={() => dispatch("cancel")} class="btn-secondary btn-outline btn-lg btn" type="button">Cancel</button>
		</div>
		<div class="grow">
			<button type="submit" class="btn-primary btn-lg btn w-full" on:click={() => dispatch("confirm")}> Confirm </button>
		</div>
	</div>
</div>
