<script lang="ts">
	import type { Action } from 'svelte/action';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface $$Props extends HTMLInputAttributes {
		name: string;
		label?: string;
		helpText?: string;
		inputAction?: Action | (() => void);
	}

	export let name: string;
	export let label = '';
	export let helpText = '';
	export let inputAction: Action = () => {};

	const labelBaseClasses = ['block', 'text-sm', 'font-medium', 'text-gray-700'];
	const helpTextBaseClasses = ['mt-2', 'text-sm', 'min-h-[20px]'];
	const inputBaseClasses = ['block', 'w-full', 'border-0', 'text-sm', 'focus:outline-0', 'focus:ring-0'];

	const containerBaseClasses = [
		'flex',
		"mx-[2px]",
		'outline',
		'rounded-md',
		'shadow-sm',
		'focus-within:outline-2',
		'focus-within:outline-teal-500'
	];

	const helpTextColour = 'text-gray-500';
	const containerBorderWidth = 'outline-1 shadow-sm';
	const containerBorderColour = 'outline-gray-300';

	const labelClasses = labelBaseClasses.join(' ');
	const inputClasses = inputBaseClasses.join(' ');
	const helpTextClasses = helpTextBaseClasses.concat(helpTextColour).join(' ');
	const containerClasses = containerBaseClasses.concat(containerBorderColour, containerBorderWidth).join(' ');
</script>

<div class={`mb-[2px] ${label ? "space-y-2" : ""}`}>
	<label for={name} class={labelClasses}>
		{label}
		{#if $$restProps.required}
			<span class="text-md font-medium text-red-700">*</span>
		{/if}
	</label>
	<div class={containerClasses}>
		{#if $$slots.startAdornment}
			<div class="pr-0 pl-3 flex items-center bg-white text-gray-400">
				<slot name="startAdornment" />
			</div>
		{/if}
		<input type="text" id={name} aria-label={name} class={inputClasses} {name} {...$$restProps} use:inputAction />
		{#if $$slots.endAdornment}
			<div class="pl-1 pr-3 flex items-center bg-white text-gray-400">
				<slot name="endAdornment" />
			</div>
		{/if}
	</div>
	{#if helpText}
		<p class={helpTextClasses}>{helpText}</p>
	{/if}
</div>
