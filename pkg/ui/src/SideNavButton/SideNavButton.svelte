<script lang="ts">
	import { filterPositionClass } from '../utils/styles';

	let inputClasses = '';
	export { inputClasses as class };
	export let selected = false;
	export let as = 'button';

	const baseClasses = ['relative', 'w-14', 'h-14', 'rounded-lg', 'p-4', 'cursor-pointer'];

	$: bgColor = selected ? 'bg-gray-900' : 'bg-none';
	$: iconColor = selected ? 'text-white' : 'text-gray-400 hover:text-white';

	$: filteredBaseClasses = filterPositionClass(inputClasses, [...baseClasses, bgColor, iconColor]);

	$: finalClasses = [...filteredBaseClasses, inputClasses].join(' ').trim();
</script>

<svelte:element this={as} class={finalClasses} on:click>
	<slot />
</svelte:element>
