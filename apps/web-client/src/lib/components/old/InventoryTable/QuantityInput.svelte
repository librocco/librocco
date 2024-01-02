<script lang="ts">
	import { XCircle, CheckCircle } from "lucide-svelte";

	import { clickOutsideAction } from "../actions";

	import type { HTMLInputAttributes } from "svelte/elements";

	interface $$Props extends HTMLInputAttributes {}

	export let value: number = 0;

	let input: HTMLInputElement;

	let isEditing = false;

	// Reset the value to the initial value (and hide the buttons)
	const reset = () => {
		isEditing = false;
		input.value = value.toString();
	};

	// Show buttons when the input is focused
	const handleFocus = () => {
		isEditing = true;
	};

	const handleKeydown = (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
		if (e.key === "Escape") {
			e.stopPropagation();
			e.currentTarget.blur();
			reset();
		}
	};
</script>

<div class="relative w-12" use:clickOutsideAction on:clickoutside={reset}>
	{#if isEditing}
		<button type="button" class="absolute top-1/2 -left-1 -translate-x-full -translate-y-1/2 text-red-400" on:click={reset}>
			<XCircle />
		</button>
	{/if}

	<input
		class="w-full rounded-sm py-0.5 px-1 text-center"
		type="number"
		{value}
		{...$$restProps}
		bind:this={input}
		on:keydown={handleKeydown}
		on:focus={handleFocus}
	/>

	{#if isEditing}
		<button
			aria-label="Update row quantity"
			type="submit"
			class="absolute top-1/2 -right-1 translate-x-full -translate-y-1/2 text-green-400"
		>
			<CheckCircle />
		</button>
	{/if}
</div>

<style>
	/* Chrome, Safari, Edge, Opera */
	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	input[type="number"] {
		appearance: textfield;
		-moz-appearance: textfield;
	}
</style>
