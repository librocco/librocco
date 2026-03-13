import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

const truthy = new Set(["t", "true", "y", "yes", "on", "1"]);

const packageMetadata = {
	"@vlcn.io/crsqlite": {
		root: "deps/cr-sqlite/core",
		main: "nodejs-helper.js"
	},
	"@vlcn.io/crsqlite-wasm": {
		root: "packages/crsqlite-wasm",
		main: "dist/index.js",
		specialSubpaths: {
			"crsqlite.wasm": "dist/crsqlite.wasm"
		}
	},
	"@vlcn.io/rx-tbl": {
		root: "packages/rx-tbl",
		main: "dist/index.js"
	},
	"@vlcn.io/wa-sqlite": {
		root: "deps/wa-sqlite",
		main: "src/sqlite-api.js"
	},
	"@vlcn.io/ws-browserdb": {
		root: "packages/ws-browserdb",
		main: "dist/index.js"
	},
	"@vlcn.io/ws-client": {
		root: "packages/ws-client",
		main: "dist/index.js",
		specialSubpaths: {
			"worker.js": "dist/worker/worker.js"
		}
	},
	"@vlcn.io/ws-common": {
		root: "packages/ws-common",
		main: "dist/index.js"
	},
	"@vlcn.io/ws-server": {
		root: "packages/ws-server",
		main: "dist/index.js"
	},
	"@vlcn.io/xplat-api": {
		root: "packages/xplat-api",
		main: "dist/xplat-api.js"
	}
};

function normalizePathForResolver(value) {
	return value.split(path.sep).join("/");
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function asBool(value) {
	if (value === null || value === undefined) return false;
	if (typeof value === "boolean") return value;
	return truthy.has(String(value).trim().toLowerCase());
}

function resolveAgainstRepo(repoRoot, targetPath) {
	if (path.isAbsolute(targetPath)) return path.resolve(targetPath);
	return path.resolve(repoRoot, targetPath);
}

function getPackageResolutionTable(vlcnRoot) {
	return Object.fromEntries(
		Object.entries(packageMetadata).map(([name, metadata]) => {
			const packageRoot = path.resolve(vlcnRoot, metadata.root);
			const mainEntry = path.resolve(packageRoot, metadata.main);
			const specialSubpaths = Object.fromEntries(
				Object.entries(metadata.specialSubpaths ?? {}).map(([subpath, relativeTarget]) => [subpath, path.resolve(packageRoot, relativeTarget)])
			);

			return [
				name,
				{
					packageRoot,
					mainEntry,
					specialSubpaths
				}
			];
		})
	);
}

export function getVendorSourceState(options = {}) {
	const repoRoot = path.resolve(options.repoRoot ?? REPO_ROOT);
	const explicitVlcnRoot = process.env.VLCN_ROOT?.trim();
	const useSubmodules = asBool(process.env.USE_SUBMODULES);

	let vlcnRoot = null;
	let legacyMode = false;

	if (explicitVlcnRoot) {
		vlcnRoot = resolveAgainstRepo(repoRoot, explicitVlcnRoot);
	} else if (useSubmodules) {
		vlcnRoot = path.join(repoRoot, "3rd-party", "js");
		legacyMode = true;
	}

	if (!vlcnRoot) {
		return {
			enabled: false,
			repoRoot,
			vlcnRoot: null,
			legacyMode: false
		};
	}

	if (!fs.existsSync(vlcnRoot)) {
		throw new Error(`VLCN source mode requested, but ${vlcnRoot} does not exist.`);
	}

	return {
		enabled: true,
		repoRoot,
		vlcnRoot,
		legacyMode
	};
}

export function logVendorSourceMode(scope = "vendor-source", logger = console.log, options = {}) {
	const state = getVendorSourceState(options);

	logger("");
	if (!state.enabled) {
		logger(`${scope}: using @vlcn.io packages installed from npm.codemyriad.io`);
	} else {
		logger(`${scope}: using local @vlcn.io sources from ${state.vlcnRoot}`);
		if (state.legacyMode) {
			logger(`${scope}: USE_SUBMODULES is legacy; prefer VLCN_ROOT for explicit source mode`);
		}
	}
	logger("");

	return state;
}

export function getWebClientVendorAliasMap(options = {}) {
	const state = getVendorSourceState(options);
	if (!state.enabled) return {};

	const table = getPackageResolutionTable(state.vlcnRoot);

	return {
		"@vlcn.io/crsqlite": table["@vlcn.io/crsqlite"].mainEntry,
		"@vlcn.io/crsqlite-wasm": table["@vlcn.io/crsqlite-wasm"].packageRoot,
		"@vlcn.io/rx-tbl": table["@vlcn.io/rx-tbl"].packageRoot,
		"@vlcn.io/wa-sqlite": table["@vlcn.io/wa-sqlite"].packageRoot,
		"@vlcn.io/ws-browserdb": table["@vlcn.io/ws-browserdb"].packageRoot,
		"@vlcn.io/ws-client/worker.js": table["@vlcn.io/ws-client"].specialSubpaths["worker.js"],
		"@vlcn.io/ws-client": table["@vlcn.io/ws-client"].packageRoot,
		"@vlcn.io/ws-common": table["@vlcn.io/ws-common"].packageRoot,
		"@vlcn.io/ws-server": table["@vlcn.io/ws-server"].packageRoot,
		"@vlcn.io/xplat-api": table["@vlcn.io/xplat-api"].packageRoot
	};
}

export function getViteVendorAliasEntries(options = {}) {
	const state = getVendorSourceState(options);
	if (!state.enabled) return [];

	const table = getPackageResolutionTable(state.vlcnRoot);
	const aliasEntries = [];

	for (const [packageName, resolution] of Object.entries(table)) {
		const escapedPackageName = escapeRegExp(packageName);

		for (const [subpath, targetPath] of Object.entries(resolution.specialSubpaths)) {
			const escapedSubpath = escapeRegExp(subpath);
			aliasEntries.push({
				find: new RegExp(`^${escapedPackageName}/${escapedSubpath}$`),
				replacement: normalizePathForResolver(targetPath)
			});
		}

		aliasEntries.push({
			find: new RegExp(`^${escapedPackageName}$`),
			replacement: normalizePathForResolver(resolution.mainEntry)
		});

		aliasEntries.push({
			find: new RegExp(`^${escapedPackageName}/(.*)$`),
			replacement: `${normalizePathForResolver(resolution.packageRoot)}/$1`
		});
	}

	return aliasEntries;
}

export function resolveVendorSourceSpecifier(specifier, options = {}) {
	const state = getVendorSourceState(options);
	if (!state.enabled) return null;

	const table = getPackageResolutionTable(state.vlcnRoot);

	for (const [packageName, resolution] of Object.entries(table)) {
		if (specifier === packageName) {
			return resolution.mainEntry;
		}

		for (const [subpath, targetPath] of Object.entries(resolution.specialSubpaths)) {
			if (specifier === `${packageName}/${subpath}`) {
				return targetPath;
			}
		}

		if (specifier.startsWith(`${packageName}/`)) {
			return path.join(resolution.packageRoot, specifier.slice(packageName.length + 1));
		}
	}

	return null;
}
