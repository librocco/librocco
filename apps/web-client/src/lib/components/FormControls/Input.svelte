<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import type { Action } from "svelte/action";

	interface $$Props extends HTMLInputAttributes {
		name: string;
		label?: string;
		helpText?: string;
		errorText?: string;
		inputRef?: HTMLInputElement | null;
		inputAction?: Action<HTMLElement, any> | (() => void);
		class?: string;
	}

	let className = "";
	export { className as class };

	export let name: string;

	export let value: string = "";

	export let type = "text";
	export let label = "";
	export let helpText = "";
	export let errorText = "";
	export let required = false;
	export let inputRef = null;
	export let inputAction: Action<HTMLElement, any> = () => {};

	const labelBaseClasses = ["block", "text-base", "font-medium", "text-base-content"];
	const helpTextBaseClasses = ["mt-2", "text-sm", "min-h-[20px]", "text-base-content/70"];
	const inputBaseClasses = [
		"block",
		"w-full",
		"border-0",
		"bg-base-100",
		"text-base",
		"text-base-content",
		"placeholder:text-base-content/50",
		"focus:outline-0",
		"focus:ring-0",
		"disabled:cursor-not-allowed",
		"disabled:bg-base-200",
		"disabled:text-base-content/50"
	];

	const containerBaseClasses = [
		"flex",
		"mx-[2px]",
		"outline",
		"rounded-md",
		"bg-base-100",
		"focus-within:outline-none",
		"focus-within:ring-2",
		"focus-within:ring-teal-500",
		"focus-within:ring-offset-2",
		"focus-within:ring-offset-base-100"
	];

	const helpTextColour = "text-oyster-500 font-regular";
	const errorTextColour = "text-red-500 font-regular";
	const containerBorderWidth = "outline-1";
	const containerBorderColour = "outline-base-300";
	const errorBorderColour = "outline-red-500";

	const labelClasses = labelBaseClasses.join(" ");
	const inputClasses = inputBaseClasses.join(" ");
	const helpTextClasses = helpTextBaseClasses.concat(helpTextColour).join(" ");
	const errorTextClasses = helpTextBaseClasses.concat(errorTextColour).join(" ");
	const containerClasses = containerBaseClasses
		.concat(`${errorText ? errorBorderColour : containerBorderColour}`, containerBorderWidth)
		.join(" ");

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
			<div class="flex items-center bg-base-100 pl-3 pr-0 text-base-content/50">
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
			<div class="flex items-center bg-base-100 pl-1 pr-3 text-base-content/50">
				<slot name="end-adornment" />
			</div>
		{/if}
	</div>
	{#if errorText}
		<p class={errorTextClasses}>{errorText}</p>
	{:else if helpText}
		<p class={helpTextClasses}>{helpText}</p>
	{/if}
</div>
