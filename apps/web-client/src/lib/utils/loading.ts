import type { DbCtx } from "$lib/db/cr-sqlite";
import type { AsyncData } from "$lib/types/async-data";

/**
 * Resolves the DbCtx from the parent data, handling the AsyncData pattern.
 *
 * Usage in load functions:
 * const dbCtx = await resolveDbCtx(await parent());
 */
export async function resolveDbCtx(dbCtxOrPromise: AsyncData<DbCtx>): Promise<DbCtx | null> {
	if (!dbCtxOrPromise) return null;
	return await dbCtxOrPromise;
}
