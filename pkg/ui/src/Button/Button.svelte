<script lang="ts">
	import type { SvelteComponentTyped } from 'svelte';

	import { ButtonColor, ButtonShape, ButtonSize, IconPosition } from './enums';
	import {
		shapeRadiusLookup,
		textSizeLookup,
		shapeSpacingLookup,
		colorClassesLookup,
		iconSizeLookup,
		iconSpacingLookup,
		iconColorLookup
	} from './styles';

	let className = '';
	export { className as class };
	export let size: ButtonSize = ButtonSize.Base;
	export let shape: ButtonShape = ButtonShape.Square;
	export let color: ButtonColor = ButtonColor.Primary;
	/** This is should be an SVG as svelte component @TODO sort out the typings here */
	export let Icon: any = null;
	export let iconPosition: IconPosition = IconPosition.Start;
	export let as: string = 'button';

	$: shapeClass = shape === ButtonShape.Circular ? 'rounded-full' : shapeRadiusLookup[shape][size];
	$: textClasses = textSizeLookup[size];
	$: spacingClasses = shapeSpacingLookup[shape][size];
	$: sizeClasses = [textClasses, spacingClasses].join(' ');
	$: colorClasses = colorClassesLookup[color];
	const focusClasses =
		'focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white';
	$: containerClasses = [sizeClasses, shapeClass, colorClasses, focusClasses, className].join(' ');

	$: showIcon = Icon && shape !== ButtonShape.Circular;
	$: iconSizeClasses = iconSizeLookup[size];
	$: iconSpacingClasses = iconSpacingLookup[iconPosition][size];
	$: iconColorClass = iconColorLookup[color];
	$: iconClasses = ['block', iconSizeClasses, iconSpacingClasses, iconColorClass].join(' ');
</script>

<svelte:element this={as} class={containerClasses} on:click>
	<span class="flex items-center">
		{#if showIcon && iconPosition === IconPosition.Start}
			<span class={iconClasses}><svelte:component this={Icon} /></span>
		{/if}

		<slot />

		{#if showIcon && iconPosition === IconPosition.End}
			<span class={iconClasses}><svelte:component this={Icon} /></span>
		{/if}
	</span>
</svelte:element>
