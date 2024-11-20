<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { PageCenterDialog, type DialogProps } from "$lib/components/Melt";

	export let dialog: DialogProps;
	export let bookCount: number;

	const dispatch = createEventDispatcher<{
		confirm: void;
		cancel: void;
	}>();
</script>

<PageCenterDialog {dialog} title="" description="">
	<div class="prose flex max-w-none flex-col gap-y-6">
		<p>
			{bookCount} books will be marked as delivered. Customer orders will be updated to reflect that the book is ready
			to be collected.
		</p>

		<div class="flex justify-end gap-x-3">
			<button class="btn-ghost btn" on:click={() => dispatch("cancel")}>Cancel</button>
			<button class="btn-primary btn" on:click={() => dispatch("confirm")}>Confirm</button>
		</div>
	</div>
</PageCenterDialog>
