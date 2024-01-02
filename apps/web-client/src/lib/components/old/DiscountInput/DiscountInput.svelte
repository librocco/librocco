<script lang="ts">
	import { createEventDispatcher, tick } from "svelte";
	import { XCircle, CheckCircle } from "lucide-svelte";

	export let name = "discount";
	export let label = "";
	export let value = 0;

	const maxValue = 100;

	let input: HTMLInputElement;

	let isEditing = false;

	const dispatch = createEventDispatcher<{ submit: number }>();

	// Reset the value to the initial value (and hide the buttons)
	const reset = () => {
		isEditing = false;
		tick().then(() => {
			input.value = value.toString();
		});
	};

	// Show buttons when the input is focused
	const handleFocus = () => {
		isEditing = true;
	};

	// Submit the input value
	const submit = () => {
		const intValue = parseInt(input.value);
		// Update (exported) 'value', this will trigger a two-way binding update
		value = intValue;
		// Dispatch the 'submit' event in case the parent is using the component in an uncontrolled way
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
				input.value = "";
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

<div class="inline-block pr-8">
	<div class="flex items-center gap-x-2 text-base font-light text-gray-500">
		<p>{label}</p>
		<div class="relative w-12">
			{#if isEditing}
				<button class="absolute top-1/2 -left-1 -translate-x-full -translate-y-1/2 bg-white text-red-400" on:click={reset}>
					<XCircle />
				</button>
			{/if}

			<input
				class="arrows-hidden w-full rounded-sm border-gray-400 py-0 px-0.5 text-center"
				{name}
				type="number"
				{value}
				bind:this={input}
				on:keydown={handleKeydown}
				on:input={validate}
				on:focus={handleFocus}
				on:blur={reset}
			/>

			{#if isEditing}
				<button type="submit" class="absolute top-1/2 -right-1 translate-x-full -translate-y-1/2 bg-white text-green-400">
					<CheckCircle />
				</button>
			{/if}
		</div>
		<span>%</span>
	</div>
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
