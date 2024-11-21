<script lang="ts">
	import { createEventDispatcher } from "svelte";

	export let bookCount: number;

	const dispatch = createEventDispatcher<{
		confirm: void;
		cancel: void;
	}>();
</script>

<div class="prose flex max-w-none flex-col gap-y-2 p-6">
	<h3>{bookCount} books will be marked as delivered.</h3>
	<p>Customer orders will be updated to reflect that the book is ready to be collected.</p>

	<div class="stretch flex w-full gap-x-4">
		<div class="basis-fit">
			<button on:click={() => dispatch("cancel")} class="btn-secondary btn-outline btn-lg btn" type="button">Cancel</button>
		</div>
		<div class="grow">
			<button type="submit" class="btn-primary btn-lg btn w-full" on:click={() => dispatch("confirm")}> Confirm </button>
		</div>
	</div>
</div>
