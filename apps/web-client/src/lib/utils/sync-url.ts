import { GIT_SHA } from "$lib/constants";

/**
 * Appends this build's version to the sync WebSocket URL as a `client_version`
 * query parameter. The sync server logs it per connection and can refuse
 * known-problematic versions at the upgrade (see sync-server `version-gate.ts`,
 * Linear D-609). A malformed URL is returned untouched - sync startup has its
 * own URL validation and error surface.
 */
export function withClientVersion(url: string, version: string = GIT_SHA): string {
	try {
		const parsed = new URL(url);
		parsed.searchParams.set("client_version", version);
		return parsed.toString();
	} catch {
		return url;
	}
}
