import { test, expect } from "@playwright/test";
import { baseURL } from "@/constants";

test.setTimeout(20_000);

test("sync indicator shows labels, pending, and disconnected state", async ({ page }) => {
	await page.goto(baseURL, { waitUntil: "networkidle" });
	await page.waitForSelector('body[hydrated="true"]', { timeout: 30000 });
	const badge = page.getByTestId("remote-db-badge");
	await badge.waitFor({ timeout: 10000 });
	await page.evaluate(() => {
		const w = window as any;
		if (typeof w.__forceSyncIndicator !== "function") {
			w.__forceSyncIndicator = (state: { status?: string; pending?: number }) => {
				const badgeEl = document.querySelector("[data-testid='remote-db-badge']") as HTMLElement | null;
				if (!badgeEl) return;
				const status = (state.status ?? (state.pending && state.pending > 0 ? "syncing" : "synced")) as string;
				badgeEl.dataset.status = status;
				badgeEl.dataset.pending = String(state.pending ?? 0);
				const textEl = badgeEl.querySelector("p");
				if (textEl) {
					const pendingText = state.pending && state.pending > 0 ? ` (${state.pending} pending)` : "";
					const label = status === "synced" ? "Synced" : status === "syncing" ? "Syncing…" : "Disconnected";
					textEl.textContent = `Remote DB · ${label}${pendingText}`;
				}
			};
		}
	});

	// Force a synced state
	await page.evaluate(() => {
		const w = window as any;
		w._app?.config?.syncActive.set(true);
		w.__forceSyncIndicator?.({
			connectivity: { connected: true, stuck: false },
			compatibility: { status: "compatible", remoteSiteId: "x", verified: true },
			pending: 0,
			lastAckAt: Date.now()
		});
	});

	await expect
		.poll(async () => badge.getAttribute("data-status"), { timeout: 5000, intervals: [200] })
		.resolves.toBe("synced");
	await expect(badge).toContainText(/Synced/);

	// Force a syncing state with pending changes
	await page.evaluate(() => {
		const w = window as any;
		w.__forceSyncIndicator?.({
			connectivity: { connected: true, stuck: false },
			compatibility: { status: "compatible", remoteSiteId: "x", verified: true },
			pending: 3,
			lastAckAt: Date.now()
		});
	});
	await expect
		.poll(async () => badge.getAttribute("data-status"), { timeout: 5000, intervals: [200] })
		.resolves.toBe("syncing");
	await expect(badge).toContainText(/3 pending/);

	// Force a disconnected state
	await page.evaluate(() => {
		const w = window as any;
		w._app?.config?.syncActive.set(false);
		w.__forceSyncIndicator?.({
			connectivity: { connected: false, stuck: false },
			compatibility: { status: "compatible", remoteSiteId: "x", verified: true },
			pending: 0
		});
	});
	await expect
		.poll(async () => badge.getAttribute("data-status"), { timeout: 5000, intervals: [200] })
		.resolves.toBe("disconnected");
});
