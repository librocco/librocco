#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { getVendorSourceState } from "./vendor_source_config.mjs";

const [command, ...args] = process.argv.slice(2);

if (!command) {
	console.error("Usage: run_with_vendor_source.mjs <command> [args...]");
	process.exit(1);
}

const env = { ...process.env };
const state = getVendorSourceState();

if (state.enabled) {
	const loaderPath = fileURLToPath(new URL("./register_vendor_source.mjs", import.meta.url));
	const importFlag = `--import=${loaderPath}`;
	const nodeOptions = env.NODE_OPTIONS?.trim();

	if (!nodeOptions?.includes(importFlag)) {
		env.NODE_OPTIONS = nodeOptions ? `${nodeOptions} ${importFlag}` : importFlag;
	}

	console.log(`[vendor-source] ${command}: using local @vlcn.io sources from ${state.vlcnRoot}`);
}

const child = spawn(command, args, {
	env,
	shell: false,
	stdio: "inherit"
});

child.on("error", (error) => {
	console.error(`Failed to execute ${command}: ${error.message}`);
	process.exit(1);
});

child.on("exit", (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}

	process.exit(code ?? 0);
});
