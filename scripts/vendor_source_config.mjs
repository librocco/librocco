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
	"@vlcn.io/logger-provider": {
		root: "packages/logger-provider",
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

const requiredBuildOutputs = [
	"deps/cr-sqlite/core/nodejs-helper.js",
	"packages/crsqlite-wasm/dist/index.js",
	"packages/rx-tbl/dist/index.js",
	"packages/logger-provider/dist/index.js",
	"packages/ws-browserdb/dist/index.js",
	"packages/ws-client/dist/index.js",
	"packages/ws-client/dist/worker/worker.js",
	"packages/ws-common/dist/index.js",
	"packages/ws-server/dist/index.js",
	"packages/xplat-api/dist/xplat-api.js"
];

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

function resolveConfiguredPath(repoRoot, targetPath) {
	if (path.isAbsolute(targetPath)) return path.resolve(targetPath);

	const cwdResolved = path.resolve(process.cwd(), targetPath);
	if (fs.existsSync(cwdResolved)) {
		return cwdResolved;
	}

	return path.resolve(repoRoot, targetPath);
}

function getVendorSourceStateFile(repoRoot) {
	return path.join(repoRoot, ".librocco", "vendor-source.json");
}

function readPreparedVendorSourceState(repoRoot) {
	const stateFile = getVendorSourceStateFile(repoRoot);

	if (!fs.existsSync(stateFile)) {
		return null;
	}

	const content = fs.readFileSync(stateFile, "utf8");
	const parsed = JSON.parse(content);
	if (typeof parsed.vlcnRoot !== "string" || !parsed.vlcnRoot.trim()) {
		throw new Error(`Invalid vendor source config in ${stateFile}. Re-run ./scripts/prepare_vlcn_source.sh.`);
	}

	return {
		vlcnRoot: path.resolve(parsed.vlcnRoot)
	};
}

function findMissingBuildOutputs(vlcnRoot) {
	return requiredBuildOutputs.filter((relativePath) => !fs.existsSync(path.join(vlcnRoot, relativePath)));
}

function assertVendorSourceReady(vlcnRoot) {
	const missingOutputs = findMissingBuildOutputs(vlcnRoot);
	if (missingOutputs.length === 0) {
		return;
	}

	const lines = [
		`VLCN source mode is enabled, but required build outputs are missing under ${vlcnRoot}.`,
		"Run ./scripts/prepare_vlcn_source.sh first, or disable source mode with ./scripts/prepare_vlcn_source.sh --disable.",
		"Missing outputs:"
	];
	for (const relativePath of missingOutputs) {
		lines.push(`- ${relativePath}`);
	}
	throw new Error(lines.join("\n"));
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
	const preparedState = readPreparedVendorSourceState(repoRoot);

	let vlcnRoot = null;
	let legacyMode = false;
	let source = null;

	if (explicitVlcnRoot) {
		vlcnRoot = resolveConfiguredPath(repoRoot, explicitVlcnRoot);
		source = "env";
	} else if (preparedState) {
		vlcnRoot = preparedState.vlcnRoot;
		source = "prepared";
	} else if (useSubmodules) {
		vlcnRoot = path.join(repoRoot, "3rd-party", "js");
		legacyMode = true;
		source = "legacy";
	}

	if (!vlcnRoot) {
		return {
			enabled: false,
			repoRoot,
			vlcnRoot: null,
			legacyMode: false,
			source: null
		};
	}

	if (!fs.existsSync(vlcnRoot)) {
		throw new Error(`VLCN source mode requested, but ${vlcnRoot} does not exist.`);
	}

	assertVendorSourceReady(vlcnRoot);

	return {
		enabled: true,
		repoRoot,
		vlcnRoot,
		legacyMode,
		source
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
			logger(`${scope}: USE_SUBMODULES is legacy; prefer ./scripts/prepare_vlcn_source.sh`);
		}
		if (state.source === "env") {
			logger(`${scope}: VLCN_ROOT is an escape hatch; prefer ./scripts/prepare_vlcn_source.sh for normal source mode`);
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
		"@vlcn.io/logger-provider": table["@vlcn.io/logger-provider"].packageRoot,
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
