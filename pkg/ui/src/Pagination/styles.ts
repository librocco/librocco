import type { ButtonState } from './types';

// #region buttonClasses
const buttonBaseClasses =
	'w-10 h-[38px] flex items-center justify-center text-sm leading-5 font-medium border';

const buttonStateClassLookup: Record<ButtonState, string> = {
	inactive: 'text-gray-500 border-gray-300',
	active: 'text-indigo-600 bg-indigo-50 border-indigo-500',
	hover: 'hover:bg-indigo-50',
	disabled: 'opacity-50'
};
export const getButtonClasses = (...states: ButtonState[]): string =>
	states.reduce((acc, curr) => [acc, buttonStateClassLookup[curr]].join(' '), buttonBaseClasses);
// #endregion buttonClasses
