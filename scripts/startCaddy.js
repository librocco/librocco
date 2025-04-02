#!/usr/bin/env node
const fs = require("fs");
const dgram = require("dgram");
const child_process = require("child_process");
// Get the caddy dir from environment vars. Default to '.' if undefined/empty
const CADDY_DIR = process.env.CADDY_DIR || ".";
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
if (!fs.existsSync(CADDY_DIR)) errors.push(`CADDY_DIR directory (${CADDY_DIR}) does not exist`);

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
	const escapedDNSName = dnsName.replace(/\./g, "\\.");
	const caddyConfigContent = `
{
    email ${process.env.CADDY_EMAIL}
    storage file_system ${CADDY_DIR}/data
}

${dnsName} {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    reverse_proxy 127.0.0.1:3000
}
*.${dnsName} {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    @port {
      header_regexp port Host ^[^.-]+-(\\d+)\\.${escapedDNSName}$
    }
    reverse_proxy @port localhost:{http.regexp.port.1}
}
`;
	try {
		fs.writeFileSync(caddyConfig, caddyConfigContent);
	} catch (err) {
		console.error("Error writing Caddyfile:", err);
		return;
	}
}

function startCaddy() {
	var command = `${CADDY_DIR}/caddy run --config ${CADDY_DIR}/Caddyfile`;
	if (process.platform === "darwin") {
		// Adding -E to 'sudo' keeps the environment: CADDY_DIR, CADDY_EMAIL, CLOUDFLARE_API_TOKEN
		command = "sudo -E" + command;
	}
	child_process.execSync(command, { stdio: "inherit" });
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
