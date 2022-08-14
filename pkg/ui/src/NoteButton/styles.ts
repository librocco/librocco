import { NoteButtonType, NoteButtonLabel, NoteButtonShape, Warehouse } from './enums.ts';

export const colorClassesLookup = {
	[NoteButtonType.In]: ['text-white', 'bg-green-400', 'hover:bg-green-500'],
	[NoteButtonType.Out]: ['text-white', 'bg-red-400', 'hover:bg-red-500']
};

export const borderClassesLookup = {
	[NoteButtonLabel.RemoveBooks]: NoteButtonShape.Square,
	[Warehouse.Nuovo || Warehouse.Scolastica || Warehouse.Varia]: NoteButtonShape.RoundedRight
};

// note button
export const text = ['text-md', 'leading-5'];
export const shapeSpacing = ['px-3.25', 'py-2.25'];
// button content
export const iconSizeClasses = ['w-6', 'h-6'];
export const iconSpacingClasses = ['mr-1.5', '-left-0.5'];
export const iconColorClass = 'text-white';
