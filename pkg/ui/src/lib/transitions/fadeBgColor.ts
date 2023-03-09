import type { TransitionConfig, EasingFunction } from 'svelte/transition';

interface Params {
	duration?: number;
	easing?: EasingFunction;
	color: string;
}

export const fadeBgColor = (_: HTMLElement, { duration, easing, color }: Params): TransitionConfig => {
	return {
		duration,
		easing,
		css: (t) => `background-color: ${color}; opacity: ${t}`
	};
};
