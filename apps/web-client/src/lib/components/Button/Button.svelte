<script lang="ts">
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { ButtonColor, ButtonShape, ButtonSize } from "./enums";
	import { shapeRadiusLookup, textSizeLookup, shapeSpacingLookup, colorClassesLookup } from "./styles";

	interface $$Props extends HTMLButtonAttributes {
		class?: string;
		size?: ButtonSize;
		shape?: ButtonShape;
		color?: ButtonColor;
	}

	let className = "";
	export { className as class };
	/**
	 * Size of the button component, applies the following styles with respect to size:
	 * ```yaml
	 * text-size:
	 * 	xs:   text-xs   leading-4
	 * 	sm:   text-sm   leading-4
	 * 	base: text-sm   leading-5
	 * 	lg:   text-base leading-6
	 * 	xl:   text-base leading-6
	 *
	 * spacing: # with respect to shape
	 * 	square:
	 * 		xs:   px-[11px] py-1.75
	 * 		sm:   px-3.25   py-2.25
	 * 		base: px-4.25   py-2.25
	 * 		lg:   px-4.25   py-2.25
	 * 		xl:   px-6.25   py-3.25
	 *
	 * 	rounded:
	 * 		xs:   px-3.25   py-1.75
	 * 		sm:   px-[15px] py-2.25
	 * 		base: px-4.25   py-2.25
	 * 		lg:   px-[21px] py-2.25
	 * 		xl:   px-6.25   py-3.25
	 *
	 * 	circular:
	 * 		xs:   p-[5px]
	 * 		sm:   p-1.75
	 * 		base: p-2.25
	 * 		lg:   p-2.25
	 * 		xl:   p-3.25
	 *
	 * icon-size:
	 * 	xs:   w-4 h-4
	 * 	sm:   w-4 h-4
	 * 	base: w-5 h-5
	 * 	lg:   w-5 h-5
	 * 	xl:   w-5 h-5
	 * ```
	 */
	export let size: ButtonSize = ButtonSize.Base;
	/**
	 * Rounding of the edges (`border-radius`) of a button, applies the following classes with respect to shape:
	 * ```yaml
	 * rounded:  rounded-full
	 *
	 * square: # with respect to size
	 * 	xs:   rounded
	 * 	sm:   rounded-md
	 * 	base: rounded-md
	 * 	lg:   rounded-md
	 * 	xl:   rounded-md
	 *
	 * rounded: # with respect to size
	 * 	xs:   rounded-[15px]
	 * 	sm:   rounded-[17px]
	 * 	base: rounded-[19px]
	 * 	lg:   rounded-[21px]
	 * 	xl:   rounded-[25px]
	 * ```
	 */
	export let shape: ButtonShape = ButtonShape.Square;
	/**
	 * Applies canned colorings for a button:
	 * ```yaml
	 * primary:
	 * 	text-white bg-indigo-600 hover:bg-indigo-700
	 * secondary:
	 * 	text-indigo-700 bg-indigo-100 hover:bg-indigo-200
	 * white:
	 * 	text-gray-700 bg-white border border-gray-300 hover:bg-gray-50
	 * ```
	 */
	export let color: ButtonColor = ButtonColor.Primary;

	$: shapeClass = shape === ButtonShape.Circular ? "rounded-full" : shapeRadiusLookup[shape][size];
	$: textClasses = textSizeLookup[size];
	$: spacingClasses = shapeSpacingLookup[shape][size];
	$: sizeClasses = [textClasses, spacingClasses].join(" ");
	$: colorClasses = colorClassesLookup[color];
	const focusClasses = "focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-white";
	const disabledClasses = "disabled:text-gray-700 disabled:bg-gray-100 disabled:border disabled:border-gray-300";
	$: containerClasses = [sizeClasses, shapeClass, colorClasses, focusClasses, disabledClasses, className].join(" ");
</script>

<button class={containerClasses} on:click type="button" {...$$restProps}>
	<span class="flex items-center gap-x-2">
		{#if $$slots.startAdornment && shape !== ButtonShape.Circular}
			<slot name="startAdornment" />
		{/if}

		<slot />

		{#if $$slots.endAdornment && shape !== ButtonShape.Circular}
			<slot name="endAdornment" />
		{/if}
	</span>
</button>
