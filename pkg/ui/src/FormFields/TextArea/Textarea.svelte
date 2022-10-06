<script lang="ts">
	import { Resize } from './enums';

	export let name: string;

	export let label = '';
	export let placeholder = '';
	export let helpText = '';
	export let rows = 4;
	export let cols = 20;
	export let maxlength: number | null = null;
	export let minlength: number | null = null;
	export let resize: Resize = Resize.YAxis;
	export let disabled = false;

	const labelBaseClasses = ['block', 'text-sm', 'font-medium', 'text-gray-700'].join(' ');
	const textareaBaseClasses = [
		'block',
		'w-full',
		'rounded-md',
		'border-gray-300',
		'shadow-sm',
		'focus:border-teal-500',
		'focus:ring-teal-500',
		'focus:ring-2',
		'text-sm',
		resize
	].join(' ');
</script>

<div class="space-y-1">
	<label for={name} class={labelBaseClasses}>{label}</label>
	<div>
		<textarea
			{rows}
			{cols}
			{name}
			{placeholder}
			{maxlength}
			{minlength}
			{disabled}
			id={name}
			class={textareaBaseClasses}
		/>
	</div>
	{#if helpText}
		<p class="mt-2 text-sm min-h-[20px]">{helpText}</p>
	{/if}
</div>
