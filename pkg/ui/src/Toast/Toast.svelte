<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { fade } from "svelte/transition";

	import { X } from "lucide-svelte";

	import { ToastType } from "./enums";

	const dispatch = createEventDispatcher();

	export let type: ToastType;
	export let dismissible = true;

	const colourLookup = {
		[ToastType.Error]: "bg-red-50 text-red-900",
		[ToastType.Success]: "bg-green-50 text-green-900"
	};
</script>

<div
	class="flex max-w-fit items-center justify-between gap-x-4 rounded-lg px-4 py-2 shadow-md {colourLookup[type]}"
	role="alert"
	transition:fade
>
	<p class="text-left text-base font-normal">
		<slot />
	</p>
	{#if dismissible}
		<button
			type="button"
			aria-label="Close toast"
			class="rounded-lg p-1 text-gray-400 hover:text-gray-800 focus:outline-none focus:outline-gray-700"
			on:click={() => dispatch("dismiss")}
		>
			<X />
		</button>
	{/if}
</div>
