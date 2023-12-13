module.exports = [
	require("@tailwindcss/forms"),
	function ({ addUtilities }) {
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
