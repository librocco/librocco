/**
 * Calculates a rem value for spacing from spacing in pixels
 * @param {number} px spacing in pixels
 * @returns {string} spacing in rem with `rem` suffix, e.g. `2.125rem`
 */
const rem = (px) => `${px / 16}rem`;

module.exports = {
  extend: {
    spacing: {
      sm: rem(640),
      md: rem(768),
      lg: rem(1024),
      xl: rem(1280),
      "2xl": rem(1536),
    },
  },
};
