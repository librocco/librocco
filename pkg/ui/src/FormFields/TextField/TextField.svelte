<script lang="ts">
	import type { Action } from "svelte/action";
	import type { HTMLInputAttributes } from "svelte/elements";

	import { TextFieldSize } from "../enums";

	interface $$Props extends HTMLInputAttributes {
		name: string;
		label?: string;
		helpText?: string;
		inputAction?: Action | (() => void);
		variant?: TextFieldSize;
		error?: boolean;
	}

	export let name: string;
	export let label = "";
	export let helpText = "";
	export let inputAction: Action = () => {};
	export let variant: TextFieldSize = TextFieldSize.Base;
	export let error = false;
	$: error = error;
	let value = "";

	const labelBaseClasses = ["block", "text-sm", "font-medium", "text-gray-700"];
	const helpTextBaseClasses = ["ml-[2px]", "text-sm", "min-h-[20px]"];
	const inputBaseClasses = ["block", "w-full", "border-0", "text-sm", "focus:outline-0", "focus:ring-0", variant];

	const containerBaseClasses = ["flex", "mx-[2px]", "outline", "rounded-md", "shadow-sm", "focus-within:outline-2"];

	$: containerFocusColor = error ? "focus-within:outline-red-500" : "focus-within:outline-teal-500";

	$: helpTextColour = error ? "text-red-500" : "text-gray-500";
	const containerBorderWidth = "outline-1 shadow-sm";
	const containerBorderColour = "outline-gray-300";

	const labelClasses = labelBaseClasses.join(" ");
	const inputClasses = inputBaseClasses.join(" ");
	$: helpTextClasses = helpTextBaseClasses.concat(helpTextColour).join(" ");
	$: containerClasses = containerBaseClasses.concat(containerBorderColour, containerBorderWidth, containerFocusColor).join(" ");
</script>

<div class="my-[2px] {label ? 'space-y-2' : ''}">
	<label for={name} class={labelClasses}>
		{label}
		{#if $$restProps.required}
			<span class="text-md font-medium text-red-700">*</span>
		{/if}
	</label>
	<div class={containerClasses}>
		{#if $$slots.startAdornment}
			<div class="flex items-center bg-white pr-0 pl-3 text-gray-400">
				<slot name="startAdornment" />
			</div>
		{/if}
		<input bind:value type="text" id={name} aria-label={name} class={inputClasses} {name} {...$$restProps} use:inputAction />
		{#if $$slots.endAdornment}
			<div class="flex items-center bg-white pl-1 pr-3 text-gray-400">
				<slot {value} name="endAdornment" />
			</div>
		{/if}
	</div>
	{#if helpText}
		<p class={helpTextClasses}>{helpText}</p>
	{/if}
</div>
