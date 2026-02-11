<script lang="ts">
	import { createRadioGroup, melt } from "@melt-ui/svelte";
	import { createEventDispatcher } from "svelte";

	type UnderdeliveryOption = "pending" | "queue";

	const dispatch = createEventDispatcher<{ change: UnderdeliveryOption }>();

	export let defaultValue: UnderdeliveryOption = "pending";

	const {
		states: { value },
		elements: { root: radioRoot, item },
		helpers: { isChecked }
	} = createRadioGroup({ defaultValue });
	$: dispatch("change", $value as UnderdeliveryOption);

	const underdeliveryOptions: UnderdeliveryOption[] = ["pending", "queue"];
</script>

<div class="p-4">
	<h4 class="text-muted-foreground mb-2 text-xs uppercase tracking-wide">Action for missing books</h4>

	<div use:melt={$radioRoot} class="grid grid-cols-1 gap-2 sm:grid-cols-2">
		{#each underdeliveryOptions as option}
			<button
				class="flex cursor-pointer items-center gap-2 rounded border p-2 transition-all {$isChecked(option)
					? 'border-neutral-700 bg-[#f8f8f8]'
					: 'bg-card border-neutral-300'}"
				use:melt={$item(option)}
				aria-labelledby="${option}-label"
			>
				{#if $isChecked(option)}
					<div class="flex h-4 w-4 items-center justify-center rounded-full border-2 border-neutral-700 bg-neutral-700">
						<div class="h-2 w-2 rounded-full bg-white"></div>
					</div>
				{:else}
					<div class="flex h-4 w-4 items-center justify-center rounded-full border-2 border-neutral-300 bg-white"></div>
				{/if}

				<label for={option} id="{option}-label" class="cursor-pointer text-sm leading-none">Mark order as {option} delivery</label>
			</button>
		{/each}
	</div>
</div>
