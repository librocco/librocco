#!/usr/bin/env node
const fs = require("fs");
const dgram = require("dgram");
const child_process = require("child_process");
const path = require("path");
// Get the caddy dir from environment vars or use '../caddy-data' relative to this script
const CADDY_DIR = process.env.CADDY_DIR || path.join(__dirname, "..", "caddy-data");
const DNS_SUFFIX = ".static.codemyriad.io";

/*
  This script downloads the latest caddy for the current architecture with cloudflare dns support,
  gets the local ip address and configures caddy to serve there using
  a name like arbitraryname-<portnumber>.X.X.X.X.static.codemyriad.io
*/
let errors = [];
if (!process.env.CADDY_EMAIL) errors.push("CADDY_EMAIL should be defined and be a valid email address");
if (!process.env.CF_ZONE_ID) errors.push("CF_ZONE_ID should be defined and be a Cloudflare DNS zone ID");
if (!process.env.CLOUDFLARE_API_TOKEN) errors.push("CLOUDFLARE_API_TOKEN should be defined and valid");
// Create the CADDY_DIR if it doesn't exist
if (!fs.existsSync(CADDY_DIR)) {
	try {
		fs.mkdirSync(CADDY_DIR, { recursive: true });
		console.log(`Created directory: ${CADDY_DIR}`);
	} catch (err) {
		errors.push(`Failed to create CADDY_DIR directory (${CADDY_DIR}): ${err.message}`);
	}
}

if (errors.length > 0) {
	console.error("\x1b[31m\x1b[1mMissing prerequisites:\x1b[0m");
	errors.forEach((e) => console.error(e));
	process.exit(-1);
}
function checkCaddy() {
	// Make sure addy-dns/cloudflare is present in the output of ./caddy build-info
	var caddyBuildInfo = "";
	try {
		caddyBuildInfo = child_process.execSync(`${CADDY_DIR}/caddy build-info`, {
			encoding: "utf-8"
		});
	} catch (err) {
		return false;
	}
	return caddyBuildInfo.includes("addy-dns/cloudflare");
}

function checkCaddyCapabilities() {
	// On Mac, we can't set these permissions
	// Instead, we're running as root (which is handled in the script)
	if (process.platform === "darwin") {
		return true;
	}
	// Check `getcap caddy`. Return false if it's missing
	// caddy cap_net_bind_service=ep
	const caddyCapabilities = child_process.execSync(`getcap ${CADDY_DIR}/caddy`, { encoding: "utf-8" });
	return caddyCapabilities.includes("cap_net_bind_service=ep");
}

function downloadCaddy() {
	if (checkCaddy()) {
		console.log("Caddy already downloaded and working");
		return;
	}
	const osMap = { linux: "linux", darwin: "darwin", win32: "windows" };
	const archMap = { x64: "amd64", arm64: "arm64" };
	const os = osMap[process.platform] || process.platform;
	const arch = archMap[process.arch] || process.arch;
	console.log(`Downloading caddy for ${os}/${arch}`);
	child_process.execSync(
		`wget "https://caddyserver.com/api/download?os=${os}&arch=${arch}&p=github.com%2Fcaddy-dns%2Fcloudflare" -O ${CADDY_DIR}/caddy`,
		{ stdio: "inherit" }
	);
	// Make the downloaded file executable in a cross platform fashion
	if (os === "windows") {
		// On Windows just rename; '.exe' makes it executable
		fs.renameSync("caddy", "caddy.exe");
	} else {
		const stat = fs.statSync(CADDY_DIR + "/caddy");
		fs.chmodSync(CADDY_DIR + "/caddy", stat.mode | 0o111);
	}
	if (!checkCaddy()) {
		console.error("There was a problem downloading and running caddy");
		return;
	}
}

function getLocalIP() {
	return new Promise((resolve, reject) => {
		// Check if we were passed the localIP as an environment variable
		if (process.env.LOCAL_IP) {
			console.log("Using LOCAL_IP from environment variable");
			return resolve(process.env.LOCAL_IP);
		}

		const socket = dgram.createSocket("udp4");

		// Attempt to "connect" to an external address
		socket.connect(80, "8.8.8.8", () => {
			try {
				const localIP = socket.address().address;
				resolve(localIP);
			} catch (err) {
				reject(err);
			} finally {
				socket.close();
			}
		});

		socket.on("error", (err) => {
			reject(err);
		});
	});
}

function createConfig(localIP) {
	const caddyConfig = `${CADDY_DIR}/Caddyfile`;
	const dnsName = localIP + DNS_SUFFIX;
	// Escape dots for use in regex within the Caddyfile
	const escapedDNSName = dnsName.replace(/\./g, "\\.");
	// No need to escape dots for the site address itself
	const caddyConfigContent = `
{
    email ${process.env.CADDY_EMAIL}
    storage file_system ${CADDY_DIR}/data
}

# Base domain configuration
${dnsName} {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
        propagation_timeout 20m
        resolvers 1.1.1.1
    }

    @sync path /sync*

    # Route /sync requests to the fixed backend port
    route @sync {
        reverse_proxy 127.0.0.1:3000
    }

    # Route all other requests to the file server, trying directories first, then falling back to the SPA entry point (/stock/index.html)
    route {
        root * ./apps/web-client/build/
        try_files {path} {path}/ /stock/index.html
        file_server
    }
}

# Wildcard subdomain configuration
*.${dnsName} {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
        propagation_timeout 20m
        resolvers 1.1.1.1
    }

    # Matcher to extract port from hostname like 'sub-1234.ip.suffix'
    @port header_regexp port Host ^[^.-]+-(\\d+)\\.${escapedDNSName}$
    # Matcher for sync path
    @sync path /sync*
    # Combined matcher requiring both @sync and @port
    @syncAndPort {
        path /sync*
        header_regexp port Host ^[^.-]+-(\\d+)\\.${escapedDNSName}$
    }

    # Single route block to handle different request types
    route {
        # Handle requests matching BOTH @sync and @port (using the combined matcher)
        handle @syncAndPort {
            reverse_proxy localhost:{http.regexp.port.1}
        }

        # Fallback handle for all other requests: serve static files, trying directories first, then falling back to the SPA entry point (/stock/index.html)
        handle {
            root * ./apps/web-client/build/
            try_files {path} {path}/ /stock/index.html
            file_server
        }
    }
}
`;
	try {
		fs.writeFileSync(caddyConfig, caddyConfigContent);
		console.log(`Caddyfile written to ${caddyConfig}`); // Added log
	} catch (err) {
		console.error("Error writing Caddyfile:", err);
		// Consider exiting or throwing here if writing fails
		process.exit(1); // Exit if config can't be written
	}
}

function startCaddy() {
	// Define the directory where you want Caddy to run from
	const caddyWorkDir = path.join(__dirname, ".."); // This sets it to the parent directory of the scripts folder

	var command = `${CADDY_DIR}/caddy run --config ${CADDY_DIR}/Caddyfile`;
	if (process.platform === "darwin") {
		// Adding -E to 'sudo' keeps the environment: CADDY_DIR, CADDY_EMAIL, CLOUDFLARE_API_TOKEN
		command = "sudo -E " + command;
	}

	// Use child_process.spawn instead of execSync to set the cwd
	console.log(`Starting Caddy from directory: ${caddyWorkDir}`);
	const caddy = child_process.spawn(command, {
		cwd: caddyWorkDir,
		shell: true,
		stdio: "inherit"
	});

	caddy.on("error", (err) => {
		console.error("Failed to start Caddy:", err);
	});

	// Ensure Caddy is stopped on script exit (Ctrl+C)
	process.on("SIGINT", async () => {
		console.log("\nReceived SIGINT. Stopping Caddy...");
		await stopCaddy();
		process.exit(0);
	});
}

// Function to stop Caddy gracefully
async function stopCaddy() {
	console.log("Attempting to stop Caddy...");
	// Use sudo if we likely started with sudo (macOS check mirrors startCaddy)
	const useSudo = process.platform === "darwin";
	const stopCommand = `${useSudo ? "sudo " : ""}${CADDY_DIR}/caddy stop`;

	// Attempt to stop Caddy; ignore errors if it fails (e.g., already stopped)
	child_process.execSync(stopCommand, { stdio: "inherit" });
	// Assume success or that it was already stopped. No need to log success explicitly here.
}

async function createCFRecords(localIP) {
	// Create two record: a stem one and a wildcard one
	const records = [
		{ name: localIP + DNS_SUFFIX, content: localIP },
		{ name: "*." + localIP + DNS_SUFFIX, content: localIP }
	];
	for (const { name, content } of records) {
		console.log(name, content);
		const result = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/dns_records`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`
			},
			body: JSON.stringify({
				comment: "Testing HTTP api",
				content,
				name,
				proxied: false,
				ttl: 3600,
				type: "A"
			})
		});
		resultJson = await result.json();
		console.log(resultJson);
		// Check if there are errors and raise, UNLESS the error looks like this:
		//   errors: [ { code: 81058, message: 'An identical record already exists.' } ],
		if (resultJson.errors.length > 0) {
			if (resultJson.errors.length !== 1 || resultJson.errors[0].code !== 81058) {
				console.error(`\x1b[31m\x1b[1mError creating DNS record:\x1b[0m`, resultJson.errors);
				process.exit(1);
			}
		}
	}
}

(async function main() {
	const localIP = await getLocalIP();
	console.log("Local IP:", localIP);
	console.log("Use environment variable LOCAL_IP to override");
	downloadCaddy();
	if (!checkCaddyCapabilities()) {
		console.error(`\x1b[31m\x1b[1mCaddy does not have the required capabilities. Please run:\x1b[0m`);
		console.error(`sudo setcap cap_net_bind_service=ep ${CADDY_DIR}/caddy`);
		console.error("and rerun this script");
		process.exit(-1);
	}
	createConfig(localIP);
	await createCFRecords(localIP);
	startCaddy();
})();
