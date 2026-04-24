<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { writable } from "svelte/store";
	import { createRadioGroup, melt } from "@melt-ui/svelte";

	import LL from "@librocco/shared/i18n-svelte";

	type UnderdeliveryOption = "pending" | "queue";

	export let defaultValue: UnderdeliveryOption | null = "pending";
	export let supplierId: number;

	type Events = {
		change: UnderdeliveryOption;
		persistChanges: { selection: UnderdeliveryOption; supplierId: number };
	};
	const dispatch = createEventDispatcher<Events>();

	export let value = writable<UnderdeliveryOption>(defaultValue);

	const underdeliveryOptions: UnderdeliveryOption[] = ["pending", "queue"];

	const {
		elements: { root: radioRoot, item },
		helpers: { isChecked }
	} = createRadioGroup({ defaultValue });
	$: dispatch("change", $value as UnderdeliveryOption);

	$: isChanged = $value !== defaultValue;
	function handlePersistChanges() {
		dispatch("persistChanges", { selection: $value as UnderdeliveryOption, supplierId });
	}

	$: t = $LL.reconcile_page.step2.underdelivery;
</script>

<div class="p-4">
	<h4 class="text-muted-foreground mb-2 text-xs uppercase tracking-wide">{t.title()}</h4>

	<div use:melt={$radioRoot} class="grid grid-cols-1 gap-2 sm:grid-cols-2">
		{#each underdeliveryOptions as option}
			<button
				class="flex cursor-pointer items-center gap-2 rounded border p-2 transition-all {$isChecked(option)
					? 'border-base-content/50 bg-base-200'
					: 'border-base-300 bg-base-100 hover:bg-base-200/60'}"
				use:melt={$item(option)}
				aria-labelledby="${option}-label"
			>
				{#if $isChecked(option)}
					<div class="flex h-4 w-4 items-center justify-center rounded-full border-2 border-base-content/60 bg-base-content">
						<div class="h-2 w-2 rounded-full bg-base-100"></div>
					</div>
				{:else}
					<div class="flex h-4 w-4 items-center justify-center rounded-full border-2 border-base-300 bg-base-100"></div>
				{/if}

				<label for={option} id="{option}-label" class="cursor-pointer text-sm leading-none text-base-content">{t.options[option]()}</label>
			</button>
		{/each}
	</div>

	{#if isChanged && supplierId}
		<div
			class="mt-3 flex items-center justify-between gap-3 rounded border border-warning/40 bg-warning/10 p-3 text-sm text-base-content/80"
		>
			<div class="flex items-center gap-2">
				<div class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-warning/50">
					<span class="text-warning">!</span>
				</div>
				<p class="leading-tight">{t.warning()}</p>
			</div>
			<button
				onclick={handlePersistChanges}
				class="self-start rounded border border-base-300 bg-base-100 px-3 py-1 text-sm text-base-content transition-colors hover:bg-base-200"
			>
				{t.persist_button()}
			</button>
		</div>
	{/if}
</div>
