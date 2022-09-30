<script lang="ts">
	import { v4 as uuid } from 'uuid';
	export let name: string;

	export let label = '';
	export let helpText = '';
	export let checked = false;
	export let disabled = false;

	const id = uuid();

	const labelBaseClasses = ['font-medium', disabled ? 'text-gray-400' : 'text-gray-700'].join(' ');
	const helpTextColor = disabled ? 'text-gray-300' : 'text-gray-500';
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
	<div class="flex items-center h-5">
		<input
			type="checkbox"
			{id}
			aria-describedby={`${name}-description`}
			class={inputBaseClasses}
			{checked}
			{disabled}
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
