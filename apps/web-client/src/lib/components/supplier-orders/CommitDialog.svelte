<script lang="ts">
	import LL from "@librocco/shared/i18n-svelte";
	import { createEventDispatcher } from "svelte";

	export let deliveredBookCount: number;
	export let rejectedBookCount: number;

	const dispatch = createEventDispatcher<{
		confirm: void;
		cancel: void;
	}>();
</script>

<div class="prose flex max-w-none flex-col gap-y-2 p-6">
	<h3>{$LL.supplier_orders_component.commit_dialog.heading()}</h3>
	{#if deliveredBookCount > 0}
		<p>{$LL.supplier_orders_component.commit_dialog.delivered_book_count(deliveredBookCount)}</p>
	{/if}

	{#if rejectedBookCount > 0}
		<p>{$LL.supplier_orders_component.commit_dialog.rejected_book_count(rejectedBookCount)}</p>
	{/if}

	<div class="stretch flex w-full gap-x-4">
		<div class="basis-fit">
			<button on:click={() => dispatch("cancel")} class="btn-secondary btn-outline btn-lg btn" type="button">
				{$LL.supplier_orders_component.commit_dialog.cancel()}
			</button>
		</div>
		<div class="grow">
			<button type="submit" class="btn-primary btn-lg btn w-full" on:click={() => dispatch("confirm")}>
				{$LL.supplier_orders_component.commit_dialog.confirm()}
			</button>
		</div>
	</div>
</div>
