<script lang="ts">
	import { createEventDispatcher, tick } from "svelte";
	import { XCircle, CheckCircle } from "lucide-svelte";

	let initialValue = 0;
	export { initialValue as value };
	export let maxValue: number | undefined = undefined;

	let input: HTMLInputElement;

	let isEditing = false;

	const dispatch = createEventDispatcher<{ submit: number }>();

	// Reset the value to the initial value (and hide the buttons)
	const reset = () => {
		isEditing = false;
		tick().then(() => {
			input.value = initialValue.toString();
		});
	};

	// Show buttons when the input is focused
	const handleFocus = () => {
		isEditing = true;
	};

	// Submit the input value
	const submit = () => {
		const value = parseInt(input.value);
		dispatch("submit", value);
		isEditing = false;
	};

	// Validate the input value (we're not allowing specifying of negative values nor values higher than the max value)
	const validate = () => {
		tick().then(() => {
			if (input.value === "") {
				return;
			}

			const value = parseInt(input.value);
			if (value < 0) {
				input.value = "0";
			}
			if (maxValue && value > maxValue) {
				input.value = maxValue.toString();
			}
		});
	};

	const handleKeydown = (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
		if (e.key === "Enter") {
			e.stopPropagation();
			submit();
		}
		if (e.key === "Escape") {
			e.stopPropagation();
			e.currentTarget.blur();
			reset();
		}
	};
</script>

<div class="relative w-12">
	{#if isEditing}
		<button class="absolute top-1/2 -left-1 -translate-x-full -translate-y-1/2 text-red-400" on:click={reset}>
			<XCircle />
		</button>
	{/if}

	<input
		class="arrows-hidden w-full rounded-sm py-0.5 px-1 text-center"
		type="number"
		value={initialValue}
		bind:this={input}
		on:keydown={handleKeydown}
		on:input={validate}
		on:focus={handleFocus}
		on:blur={reset}
	/>

	{#if isEditing}
		<button type="submit" class="absolute top-1/2 -right-1 translate-x-full -translate-y-1/2 text-green-400">
			<CheckCircle />
		</button>
	{/if}
</div>

<style>
	/* Chrome, Safari, Edge, Opera */
	.arrows-hidden::-webkit-outer-spin-button,
	.arrows-hidden::-webkit-inner-spin-button {
		appearance: textfield;
		-webkit-appearance: none;
		-moz-appearance: textfield;
		margin: 0;
	}
</style>
