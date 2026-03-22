/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { AppSync } from "../sync";

describe("AppSyncCore.destroy", () => {
	it("cleans up worker and disposers even when stop fails", async () => {
		const appSync = new AppSync();
		const stopError = new Error("stop failure");
		const disposer = vi.fn();

		await appSync.runExclusive(async (sync) => {
			vi.spyOn(sync.worker, "startSync").mockResolvedValue(undefined);
			vi.spyOn(sync.worker, "stopSync").mockRejectedValue(stopError);
			const destroySpy = vi.spyOn(sync.worker, "destroy").mockResolvedValue(undefined);

			sync.addDisposer(disposer);
			await sync.start("dbid", "https://sync.example");

			await expect(sync.destroy()).rejects.toBe(stopError);
			expect(disposer).toHaveBeenCalledOnce();
			expect(destroySpy).toHaveBeenCalledOnce();
		});
	});
});
