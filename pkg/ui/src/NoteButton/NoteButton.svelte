<script lang="ts">
	import { ArrowCircleRight, ArrowCircleLeft } from '@librocco/svg';

	import { NoteButtonLabel, NoteButtonType, Warehouse } from './enums';

	import {
		text,
		shapeSpacing,
		iconSizeClasses,
		iconSpacingClasses,
		iconColorClass,
		colorClassesLookup,
		borderClassesLookup
	} from './styles';

	export let type: NoteButtonType = NoteButtonType.In;
	export let label: NoteButtonLabel | Warehouse = Warehouse.Nuovo;
	export let classes: string = '';

	const arrowIconLookup = {
		[NoteButtonType.In]: ArrowCircleRight,
		[NoteButtonType.Out]: ArrowCircleLeft
	};
	const Icon = arrowIconLookup[type];

	const color = colorClassesLookup[type];
	const border = borderClassesLookup[label];
	const buttonClasses = [
		classes,
		'flex',
		'items-center',
		border,
		...text,
		...shapeSpacing,
		...color
	].join(' ');
	const buttonContentClasses = [
		'flex',
		'items-center',
		...iconSizeClasses,
		...iconSpacingClasses,
		iconColorClass
	].join(' ');
</script>

<span class={border}>
	<button class={buttonClasses}>
		<div class={buttonContentClasses}>
			<svelte:component this={Icon} />
		</div>
		{label}
	</button>
</span>
