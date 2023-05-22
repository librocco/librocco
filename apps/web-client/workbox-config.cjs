module.exports = {
	globDirectory: "build/",
	globPatterns: ["**/*.{css,js,png,html,ico,svg,webmanifest}"],
	swDest: ".svelte-kit/output/client/built-sw.js",
	swSrc: "workbox-sw.js"
};
