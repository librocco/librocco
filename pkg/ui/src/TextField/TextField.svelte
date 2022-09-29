<script lang="ts">
	export let label = '';
	export let placeholder = '';
	export let name = '';
	export let helpText = '';

	const labelBaseClasses = ['block', 'text-sm', 'font-medium', 'text-gray-700'];
	const helpTextBaseClasses = ['mt-2', 'text-sm', 'min-h-[20px]'];
	const inputBaseClasses = [
		'block',
		'w-full',
		'border-0',
		'text-sm',
		'focus:outline-0',
		'focus:ring-0'
	];

	const containerBaseClasses = [
		'flex',
		'outline',
		'rounded-md',
		'shadow-sm',
		'focus-within:outline-[3px]',
		'focus-within:outline-teal-500'
	];

	const helpTextColour = 'text-gray-500';
	const containerBorderWidth = 'outline-1 shadow-sm';
	const containerBorderColour = 'outline-gray-300';

	const labelClasses = labelBaseClasses.join(' ');
	const inputClasses = inputBaseClasses.join(' ');
	const helpTextClasses = helpTextBaseClasses.concat(helpTextColour).join(' ');
	const containerClasses = containerBaseClasses
		.concat(containerBorderColour, containerBorderWidth)
		.join(' ');
</script>

<div class="space-y-1">
	<label for={name} class={labelClasses}>
		{label}
	</label>
	<div class={containerClasses}>
		{#if $$slots.startAdornment}
			<div class="flex items-center mr-0 ml-3	text-gray-400">
				<slot name="startAdornment" />
			</div>
		{/if}
		<input type="text" {name} id={name} class={inputClasses} {placeholder} aria-label={name} />
		{#if $$slots.endAdornment}
			<div class="flex items-center ml-1 mr-3 text-gray-400">
				<slot name="endAdornment" />
			</div>
		{/if}
	</div>
	{#if helpText}
		<p class={helpTextClasses}>{helpText}</p>
	{/if}
</div>
