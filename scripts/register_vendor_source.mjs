import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

import { getVendorSourceState, resolveVendorSourceSpecifier } from "./vendor_source_config.mjs";

const state = getVendorSourceState();

if (state.enabled) {
	registerHooks({
		resolve(specifier, context, nextResolve) {
			const resolvedPath = resolveVendorSourceSpecifier(specifier, state);
			if (resolvedPath) {
				return {
					shortCircuit: true,
					url: pathToFileURL(resolvedPath).href
				};
			}

			return nextResolve(specifier, context);
		}
	});
}
