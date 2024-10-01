const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

const vitePreviewPort = 4174;
const port = 4173;

// Set up the middleware to inject COOP/COEP headers
app.use((req, res, next) => {
	res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
	res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
	next();
});

// Proxy all requests to the vite preview server (assuming it's running on port 4173)
app.use(
	"/",
	createProxyMiddleware({
		target: `http://localhost:${vitePreviewPort}`, // Vite preview server address
		changeOrigin: true,
		ws: true // Proxy websockets if necessary
		// onProxyRes(proxyRes, req, res) {
		// 	// You can also modify headers here if needed
		// }
	})
);

app.listen(port, () => {
	console.log(`Reverse proxy running on http://localhost:${port}`);
	console.log(`Proxying requests to Vite Preview server at http://localhost:${vitePreviewPort}`);
});
