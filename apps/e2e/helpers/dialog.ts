import { DashboardNode, DialogInterface } from "./types";

export function getDialog(parent: DashboardNode): DialogInterface {
	const dashboard = parent.dashboard;
	const container = parent.dashboard().page().locator('[role="dialog"]');

	const cancel = async () => {
		await container.getByRole("button", { name: "Cancel" }).click();
		return container.waitFor({ state: "detached" });
	};
	const confirm = async () => {
		return container.getByRole("button", { name: "Confirm" }).click();
	};

	return Object.assign(container, { dashboard, cancel, confirm });
}
