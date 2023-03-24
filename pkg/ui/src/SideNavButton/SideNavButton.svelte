<script lang="ts">
	import { filterPositionClass } from "../utils/styles";

	let inputClasses = "";
	export { inputClasses as class };
	/**
	 * A boolean flag used to switch styles for a selected button.
	 */
	export let selected = false;
	/**
	 * A custom html tag we want to render the element as (defaults to "button")
	 */
	export let as = "button";

	const baseClasses = ["relative", "w-14", "h-14", "rounded-lg", "p-4", "cursor-pointer"];

	$: bgColor = selected ? "bg-gray-900" : "bg-none";
	$: iconColor = selected ? "text-white" : "text-gray-400 hover:text-white";

	$: filteredBaseClasses = filterPositionClass(inputClasses, [...baseClasses, bgColor, iconColor]);

	$: finalClasses = [...filteredBaseClasses, inputClasses].join(" ").trim();
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<svelte:element this={as} class={finalClasses} on:click>
	<slot />
</svelte:element>
