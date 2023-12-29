<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import type { Action } from "svelte/action";

	interface $$Props extends HTMLInputAttributes {
		name: string;
		label?: string;
		helpText?: string;
		inputRef?: HTMLInputElement | null;
		inputAction?: Action | (() => void);
	}

	let className = "";
	export { className as class };

	export let name: string;

	export let value: string = "";

	export let type = "text";
	export let label = "";
	export let helpText = "";
	export let required = false;
	export let inputRef = null;
	export let inputAction: Action = () => {};

	const labelBaseClasses = ["block", "text-base", "font-medium", "text-gray-800"];
	const helpTextBaseClasses = ["mt-2", "text-sm", "min-h-[20px]", "text-gray-500"];
	const inputBaseClasses = [
		"block",
		"w-full",
		"border-0",
		"text-base",
		"placeholder-oyster-500",
		"focus:outline-0",
		"focus:ring-0",
		"disabled:cursor-not-allowed",
		"disabled:bg-oyster-100"
	];

	const containerBaseClasses = [
		"flex",
		"mx-[2px]",
		"outline",
		"outline-gray-900",
		"rounded-md",
		"focus-within:outline-none",
		"focus-within:ring-2",
		"focus-within:ring-teal-500",
		"focus-within:ring-offset-2",
		"focus-within:ring-offset-white"
	];

	const helpTextColour = "text-oyster-500 font-regular";
	const containerBorderWidth = "outline-1";
	const containerBorderColour = "outline-oyster-300";

	const labelClasses = labelBaseClasses.join(" ");
	const inputClasses = inputBaseClasses.join(" ");
	const helpTextClasses = helpTextBaseClasses.concat(helpTextColour).join(" ");
	const containerClasses = containerBaseClasses.concat(containerBorderColour, containerBorderWidth).join(" ");

	// Props passed to the built in input element or (optional) input slot
	$: inputProps = {
		id: name,
		"aria-label": name,
		class: inputClasses,
		type,
		name,
		required,
		...$$restProps
	};
</script>

<div class="mb-[2px] {$$slots.label || label ? 'space-y-2' : ''} {className}">
	<label for={name} class={labelClasses}>
		<slot name="label" {label} {required}>
			{label}
			{#if required}
				<span class="text-md text-pomegranate-700 font-medium">*</span>
			{/if}
		</slot>
	</label>
	<div class={containerClasses}>
		{#if $$slots["start-adornment"]}
			<div class="flex items-center bg-white pl-3 pr-0 text-gray-400">
				<slot name="start-adornment" />
			</div>
		{/if}
		{#if $$slots.input}
			<!-- we're allowing for optional input, as a slot, to be rendered here in case the caller needs more direct control over the element -->
			<slot name="input" props={inputProps} />
		{:else}
			<!-- if no input is passed as a slot, the default (built in) is rendered -->
			<input bind:value {...inputProps} bind:this={inputRef} use:inputAction on:select />
		{/if}
		{#if $$slots["end-adornment"]}
			<div class="flex items-center bg-white pl-1 pr-3 text-gray-400">
				<slot name="end-adornment" />
			</div>
		{/if}
	</div>
	{#if helpText}
		<p class={helpTextClasses}>{helpText}</p>
	{/if}
</div>
