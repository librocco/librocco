const defaultTheme = require("tailwindcss/defaultTheme");

/**
 * Calculates a rem value for spacing from spacing in pixels
 * @param {number} px spacing in pixels
 * @returns {string} spacing in rem with `rem` suffix, e.g. `2.125rem`
 */
const rem = (px) => `${px / 16}rem`;

module.exports = {
	extend: {
		screens: {
			xs: "475px",
			...defaultTheme.screens
		},
		spacing: {
			// Provide spacing for large elements
			sm: rem(640),
			md: rem(768),
			lg: rem(1024),
			xl: rem(1280),
			"2xl": rem(1536),

			// Extend additional spacings used more than once
			// the ones used only once are done with JIT
			//
			// NOTE:  For consistency, all spacing extensions should be keyed the same way tailwind does for defaults:
			//
			//        spacingKey = numPixels / 4
			//
			// This will prevent confusion and duplication
			0.5: rem(2),
			1.5: rem(6),
			1.75: rem(7),
			2.25: rem(9),
			2.5: rem(10),
			3.25: rem(13),
			4.25: rem(17),
			6.25: rem(25)
		}
	}
};
