<script lang="ts">
	let inputClasses = '';
	export { inputClasses as class };
	export let label = '';

	const baseClasses = 'w-full h-24 flex flex-col items-stretch';
	$: finalClasses = [baseClasses, inputClasses].join(' ');
</script>

<figure class={finalClasses}>
	<div class="w-full h-full flex justify-center items-center">
		<slot />
	</div>

	{#if label}
		<figcaption class="w-full text-center text-gray-600">
			{label}
		</figcaption>
	{/if}
</figure>
