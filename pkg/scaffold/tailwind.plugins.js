/**
 * Calculates a rem value for spacing from spacing in pixels
 * @param {number} px spacing in pixels
 * @returns {string} spacing in rem with `rem` suffix, e.g. `2.125rem`
 */
const rem = (px) => `${px / 16}rem`;

module.exports = [
	require("@tailwindcss/typography"),
	require("daisyui"),
	// require("@tailwindcss/forms"),
	function ({ addUtilities, addComponents }) {
		addComponents({
			".form": {
				"@apply flex h-auto flex-col divide-y": {}
			},
			".form-fields": {
				"@apply flex w-full flex-col justify-between gap-y-6": {}
			}
		}),
			addUtilities({
				".scrollbar-hide": {
					"&::--webkit-scrollbar": {
						display: "none"
					},
					"-ms-overflow-style": "none",
					"scrollbar-width": "none"
				},

				".center-absolute-x": {
					position: "absolute",
					left: "50%",
					transform: "translateX(-50%)"
				},
				".center-absolute-y": {
					position: "absolute",
					top: "50%",
					transform: "translateY(-50%)"
				},
				".center-absolute": {
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)"
				}
			});
	}
];
