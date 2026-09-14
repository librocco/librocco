<script lang="ts">
	import LL from "@librocco/shared/i18n-svelte";
	import { createEventDispatcher } from "svelte";

	export let deliveredBookCount: number;
	export let rejectedBookCount: number;
	export let overdeliveryLines: { isbn: string; title: string; overdeliveredQuantity: number }[] = [];

	const dispatch = createEventDispatcher<{
		confirm: void;
		cancel: void;
	}>();
</script>

<div class="prose flex max-w-none flex-col gap-y-2 p-6">
	<h3>{$LL.supplier_orders_component.commit_dialog.heading()}</h3>
	{#if deliveredBookCount > 0}
		<p>{$LL.supplier_orders_component.commit_dialog.delivered_book_count({ deliveredBookCount })}</p>
	{/if}

	{#if rejectedBookCount > 0}
		<p>{$LL.supplier_orders_component.commit_dialog.rejected_book_count({ rejectedBookCount })}</p>
	{/if}

	{#if overdeliveryLines.length > 0}
		<p>{$LL.supplier_orders_component.commit_dialog.overdelivery_description()}</p>
		<div class="max-h-56 overflow-auto rounded border border-orange-200">
			<table class="w-full border-collapse text-sm">
				<thead class="bg-orange-50">
					<tr>
						<th class="px-3 py-2 text-left">{$LL.supplier_orders_component.commit_dialog.overdelivery_table.isbn()}</th>
						<th class="px-3 py-2 text-left">{$LL.supplier_orders_component.commit_dialog.overdelivery_table.title()}</th>
						<th class="px-3 py-2 text-right">{$LL.supplier_orders_component.commit_dialog.overdelivery_table.extra()}</th>
					</tr>
				</thead>
				<tbody>
					{#each overdeliveryLines as line (line.isbn)}
						<tr class="border-t border-neutral-200">
							<td class="px-3 py-2">{line.isbn}</td>
							<td class="px-3 py-2">{line.title}</td>
							<td class="px-3 py-2 text-right font-semibold text-orange-700">+{line.overdeliveredQuantity}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
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
