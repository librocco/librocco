<script lang="ts">
	export let label = '';
	export let placeholder = '';
	export let name = '';
	export let helpText = '';

	const textareaClasses = [
		'block',
		'w-full',
		'rounded-md',
		'border-gray-300',
		'shadow-sm',
		'focus:border-indigo-500',
		'focus:ring-indigo-500',
		'sm:text-sm'
	].join(' ');
</script>

<div>
	<label for={name} class="block text-sm font-medium text-gray-700">{label}</label>
	<div class="mt-1">
		<textarea rows="4" {name} id={name} {placeholder} class={textareaClasses} />
	</div>
	{#if helpText}
		<p class="mt-2 text-sm min-h-[20px]">{helpText}</p>
	{/if}
</div>
