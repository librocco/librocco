<script lang="ts">
	import Save from "$lucide/save";
	import { createEventDispatcher } from "svelte";

	const dispatch = createEventDispatcher<{ cancel: void; confirm: void }>();

	export let heading = "";
	export let description = "";

	export let labels: Partial<Record<"cancel" | "confirm", string>> = {};
</script>

<div class="flex w-full flex-col justify-between gap-y-6 p-6">
	{#if heading}
		<div class="prose">
			<h3>
				{heading}
			</h3>
		</div>
	{/if}

	<div class="form-fields w-full"></div>
</div>

<p class="w-full px-6 pb-6">{description}</p>

<div class="stretch flex w-full gap-x-4 p-6">
	<div class="basis-fit">
		<button on:click={() => dispatch("cancel")} class="btn-secondary btn-outline btn-lg btn" type="button">{labels.cancel}</button>
	</div>

	<div class="grow">
		<button on:click={() => dispatch("confirm")} class="btn-primary btn-lg btn w-full">
			<Save aria-hidden="true" focusable="false" size={20} />
			{labels.confirm}
		</button>
	</div>
</div>
