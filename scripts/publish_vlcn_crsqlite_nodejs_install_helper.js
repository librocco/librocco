/**
 * Install helper for published crsqlite packages.
 *
 * Resolution order:
 * 1. Use an already-present dist binary.
 * 2. Copy a packaged binary from binaries/<os>-<arch>/ if one exists.
 * 3. Download a matching release asset if one exists.
 * 4. Build from source as a last resort.
 */
import { join } from "path";
import fs from "fs";
import https from "https";
import pkg from "./package.json" with { type: "json" };
import { exec } from "child_process";

let { version } = pkg;
let arch = process.arch;
let os = process.platform;
let ext = "unknown";

version = "v" + version;

if (["win32", "cygwin"].includes(os)) {
	os = "win";
}

switch (os) {
	case "darwin":
		ext = "dylib";
		break;
	case "linux":
		ext = "so";
		break;
	case "win":
		ext = "dll";
		break;
}

switch (arch) {
	case "x64":
		arch = "x86_64";
		break;
	case "arm64":
		arch = "aarch64";
		break;
}

const distPath = join("dist", `crsqlite.${ext}`);
const packagedBinaryPath = join("binaries", `${os}-${arch}`, `crsqlite.${ext}`);

if (process.env.CRSQLITE_NOPREBUILD) {
	console.log("CRSQLITE_NOPREBUILD env variable is set. Building from source.");
	buildFromSource();
} else {
	if (!fs.existsSync(join(".", "dist"))) {
		fs.mkdirSync(join(".", "dist"), { recursive: true });
	}

	if (fs.existsSync(distPath)) {
		console.log("Binary already present and installed.");
		process.exit(0);
	}

	if (fs.existsSync(packagedBinaryPath)) {
		fs.copyFileSync(packagedBinaryPath, distPath);
		console.log(`Packaged binary installed from ${packagedBinaryPath}`);
		process.exit(0);
	}

	const binaryUrl = `https://github.com/vlcn-io/cr-sqlite/releases/download/${version}/crsqlite-${os}-${arch}.zip`;
	console.log(`Look for prebuilt binary from ${binaryUrl}`);

	let redirectCount = 0;

	function get(url, cb) {
		https.get(url, (res) => {
			if (res.statusCode === 302 || res.statusCode === 301) {
				++redirectCount;
				if (redirectCount > 5) {
					throw new Error("Too many redirects");
				}
				get(res.headers.location, cb);
			} else if (res.statusCode === 200) {
				cb(res);
			} else {
				cb(null);
			}
		});
	}

	get(binaryUrl, (res) => {
		if (res == null) {
			console.log("No prebuilt binary available. Building from source.");
			buildFromSource();
			return;
		}

		const file = fs.createWriteStream(join("dist", "crsqlite.zip"));
		res.pipe(file);
		file.on("finish", () => {
			file.close();
			console.log("Prebuilt binary downloaded");
			process.chdir(join(".", "dist"));
			exec("unzip crsqlite.zip", (err, stdout, stderr) => {
				if (err) {
					console.log("Error extracting");
					console.log(err.message);
					process.exit(1);
				}
				if (stderr) {
					console.log(stderr);
				}
				console.log("Prebuilt binary extracted");
				process.exit(0);
			});
		});
	});
}

function buildFromSource() {
	console.log("Building from source");
	exec("make loadable", (err, stdout, stderr) => {
		if (err) {
			console.log("Error building from source");
			console.log(err.message);
			process.exit(1);
		}
		if (stderr) {
			console.log(stderr);
		}
		console.log("Built from source");
		console.log(stdout);
		process.exit(0);
	});
}
