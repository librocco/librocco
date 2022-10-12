import { ButtonShape, ButtonSize, ButtonColor } from './enums';

// #region sizeStyles
/**
 * ```yaml
 * xs:   text-xs   leading-4
 * sm:   text-sm   leading-4
 * base: text-sm   leading-5
 * lg:   text-base leading-6
 * xl:   text-base leading-6
 * ```
 */
export const textSizeLookup: Record<ButtonSize, string> = {
	[ButtonSize.XS]: 'text-xs leading-4',
	[ButtonSize.SM]: 'text-sm leading-4',
	[ButtonSize.Base]: 'text-sm leading-5',
	[ButtonSize.LG]: 'text-base leading-6',
	[ButtonSize.XL]: 'text-base leading-6'
};

/**
 * ```yaml
 * square:
 * 	xs:   px-[11px] py-1.75
 * 	sm:   px-3.25   py-2.25
 * 	base: px-4.25   py-2.25
 * 	lg:   px-4.25   py-2.25
 * 	xl:   px-6.25   py-3.25
 *
 * rounded:
 * 	xs:   px-3.25   py-1.75
 * 	sm:   px-[15px] py-2.25
 * 	base: px-4.25   py-2.25
 * 	lg:   px-[21px] py-2.25
 * 	xl:   px-6.25   py-3.25
 *
 * circular:
 * 	xs:   p-[5px]
 * 	sm:   p-1.75
 * 	base: p-2.25
 * 	lg:   p-2.25
 * 	xl:   p-3.25
 * ```
 */
export const shapeSpacingLookup: Record<ButtonShape, Record<ButtonSize, string>> = {
	[ButtonShape.Square]: {
		[ButtonSize.XS]: 'px-[11px] py-1.75',
		[ButtonSize.SM]: 'px-3.25 py-2.25',
		[ButtonSize.Base]: 'px-4.25 py-2.25',
		[ButtonSize.LG]: 'px-4.25 py-2.25',
		[ButtonSize.XL]: 'px-6.25 py-3.25'
	},
	[ButtonShape.Rounded]: {
		[ButtonSize.XS]: 'px-3.25 py-1.75',
		[ButtonSize.SM]: 'px-[15px] py-2.25',
		[ButtonSize.Base]: 'px-4.25 py-2.25',
		[ButtonSize.LG]: 'px-[21px] py-2.25',
		[ButtonSize.XL]: 'px-6.25 py-3.25'
	},
	[ButtonShape.Circular]: {
		[ButtonSize.XS]: 'p-[5px]',
		[ButtonSize.SM]: 'p-1.75',
		[ButtonSize.Base]: 'p-2.25',
		[ButtonSize.LG]: 'p-2.25',
		[ButtonSize.XL]: 'p-3.25'
	}
};
// #region sizeStyles

// #region shapeStyles
/**
 * ```yaml
 * square:
 * 	xs:   rounded
 * 	sm:   rounded-md
 * 	base: rounded-md
 * 	lg:   rounded-md
 * 	xl:   rounded-md
 *
 * rounded:
 * 	xs:   rounded-[15px]
 * 	sm:   rounded-[17px]
 * 	base: rounded-[19px]
 * 	lg:   rounded-[21px]
 * 	xl:   rounded-[25px]
 * ```
 */
export const shapeRadiusLookup: Record<
	ButtonShape.Square | ButtonShape.Rounded,
	Record<ButtonSize, string>
> = {
	[ButtonShape.Square]: {
		[ButtonSize.XS]: 'rounded',
		[ButtonSize.SM]: 'rounded-md',
		[ButtonSize.Base]: 'rounded-md',
		[ButtonSize.LG]: 'rounded-md',
		[ButtonSize.XL]: 'rounded-md'
	},
	[ButtonShape.Rounded]: {
		[ButtonSize.XS]: 'rounded-[15px]',
		[ButtonSize.SM]: 'rounded-[17px]',
		[ButtonSize.Base]: 'rounded-[19px]',
		[ButtonSize.LG]: 'rounded-[21px]',
		[ButtonSize.XL]: 'rounded-[25px]'
	}
};
// #endregion shapeStyles

// #region colorStyles
/**
 * ```yaml
 * primary:
 * 	text-white bg-indigo-600 hover:bg-indigo-700
 * secondary:
 * 	text-indigo-700 bg-indigo-100 hover:bg-indigo-200
 * white:
 * 	text-gray-700 bg-white border border-gray-300 hover:bg-gray-50
 *
 * ```
 */
export const colorClassesLookup: Record<ButtonColor, string> = {
	[ButtonColor.Primary]: 'text-white bg-indigo-600 hover:bg-indigo-700',
	[ButtonColor.Secondary]: 'text-indigo-700 bg-indigo-100 hover:bg-indigo-200',
	[ButtonColor.White]: 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
};
