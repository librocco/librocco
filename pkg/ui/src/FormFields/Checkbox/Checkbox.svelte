<script lang="ts">
	import { v4 as uuid } from 'uuid';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface $$Props extends HTMLInputAttributes {
		name: string;
		label?: string;
		helpText?: string;
	}

	export let name: string;
	export let label = '';
	export let helpText = '';

	const id = uuid();

	const labelBaseClasses = ['font-medium', $$restProps.disabled ? 'text-gray-400' : 'text-gray-700'].join(' ');
	const helpTextColor = $$restProps.disabled ? 'text-gray-300' : 'text-gray-500';
	const inputBaseClasses = [
		'focus:ring-teal-500',
		'h-4',
		'w-4',
		'text-gray-800',
		'border-gray-300',
		'rounded',
		'disabled:text-gray-200'
	].join(' ');
</script>

<div class="relative flex items-start">
	<div class="flex h-5 items-center">
		<input
			type="checkbox"
			{id}
			aria-describedby={`${name}-description`}
			class={inputBaseClasses}
			{...$$restProps}
		/>
	</div>
	<div class="ml-3 text-sm">
		<label for={id} class={labelBaseClasses}>
			{label}
		</label>
		<p id={`${name}-description`} class={helpTextColor}>
			{helpText}
		</p>
	</div>
</div>
