import { Page } from "@playwright/test";

/**
 * Disable notification toaster during tests as notifiactions can block the UI and
 * they linger on screen causing tests to be extra slow.
 * @param page
 * @returns
 */
export function disableNotifications(page: Page) {
	return page.evaluate(() => window["disableNotifications"]?.());
}
