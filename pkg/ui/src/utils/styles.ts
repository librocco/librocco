const positionClasses = ["static", "relative", "absolute", "fixed", "sticky"];

/**
 * Checks input classes for position class, if provided, filters the position class from
 * the base classes.
 * @param {string} inputClasses CSS classes provided as 'className' prop to the component
 * @param {Array<string>} baseClasses Array of tailwind classes used as component base
 * @returns base classes with position class filtered out (if needed)
 */
export const filterPositionClass = (inputClasses: string, baseClasses: string[]): string[] => {
	inputClasses.split(" ").forEach((className) => {
		if (positionClasses.includes(className)) {
			baseClasses = baseClasses.filter((baseClass) => !positionClasses.includes(baseClass));
		}
	});
	return baseClasses;
};

/**
 * Filters a list of class names by boolean flags
 *
 * @param classes - Class name args
 * @returns
 */
export const classNames = (...classes: string[]) => classes.filter(Boolean).join(" ");
