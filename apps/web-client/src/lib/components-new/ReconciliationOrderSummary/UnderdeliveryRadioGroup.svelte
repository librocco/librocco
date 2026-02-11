<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { writable } from "svelte/store";
	import { createRadioGroup, melt } from "@melt-ui/svelte";

	type UnderdeliveryOption = "pending" | "queue";

	const dispatch = createEventDispatcher();

	export let defaultValue: UnderdeliveryOption | null = "pending";
	export let supplierId: string;

	// Store for the value (attached to Melt-UI state), exposed
	// for stories / tests when we want to explicitly control the state.
	// Prefer using on:change event listeners in production
	export let value = writable<UnderdeliveryOption>(defaultValue);

	const underdeliveryOptions: UnderdeliveryOption[] = ["pending", "queue"];

	const {
		elements: { root: radioRoot, item },
		helpers: { isChecked }
	} = createRadioGroup({ defaultValue });
	$: dispatch("change", { detail: $value as UnderdeliveryOption });

	$: isChanged = $value !== defaultValue;
	function handlePersistChanges() {
		dispatch("persistChanges", { detail: { selection: $value as UnderdeliveryOption, supplierId } });
	}
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

	{#if isChanged && supplierId}
		<div class="mt-3 flex items-center justify-between gap-3 rounded border border-neutral-300 bg-[#f8f8f8] p-3 text-sm text-neutral-600">
			<div class="flex items-center gap-2">
				<div class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-400">
					<span class="text-neutral-500">!</span>
				</div>
				<p class="leading-tight">Current choice doesn't match the default configuration for this supplier.</p>
			</div>
			<button
				onclick={handlePersistChanges}
				class="self-start rounded border border-neutral-400 bg-white px-3 py-1 text-sm transition-colors hover:border-neutral-500 hover:bg-neutral-50"
			>
				Persist changes
			</button>
		</div>
	{/if}
</div>
