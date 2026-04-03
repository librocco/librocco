const typography = require("@tailwindcss/typography");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
  ],
  theme: {
    extend: {
      colors: {
        primary:            "#6788ff",
        "primary-content":  "#E0D2FE",
        secondary:          "#F000B8",
        "secondary-content":"#FFD1F4",
        accent:             "#b19eef",
        "accent-content":   "#0B1226",
        neutral:            "#2B3440",
        "neutral-content":  "#D7DDE4",
        "base-100":         "#0B1226",
        "base-200":         "#111A33",
        "base-300":         "#24314F",
        "base-content":     "#f5f6f8",
        info:               "#00B5FF",
        "info-content":     "#001A23",
        success:            "#00A96E",
        "success-content":  "#001F14",
        warning:            "#FFBE00",
        "warning-content":  "#1A1200",
        error:              "#FF5861",
        "error-content":    "#1A0003",
      },
      borderRadius: {
        sm:   "var(--radius-sm)",
        base: "var(--radius-base)",
        md:   "var(--radius-md)",
        lg:   "var(--radius-lg)",
        xl:   "var(--radius-xl)",
        "2xl":"var(--radius-2xl)",
      },
    },
  },
  plugins: [typography],
};
