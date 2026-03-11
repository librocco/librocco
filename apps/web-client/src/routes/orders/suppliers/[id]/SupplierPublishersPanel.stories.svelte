<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";

	import SupplierPublishersPanelStoryHarnessComponent from "./SupplierPublishersPanelStoryHarness.svelte";

	export const meta: Meta = {
		title: "Routes/Orders/Suppliers/Publisher Panel",
		component: SupplierPublishersPanelStoryHarnessComponent
	};
</script>

<script lang="ts">
	import { expect, waitFor, within } from "storybook/test";

	import { Story, Template } from "@storybook/addon-svelte-csf";

	import SupplierPublishersPanelStoryHarness from "./SupplierPublishersPanelStoryHarness.svelte";

	const baseArgs = {
		supplierName: "Story Supplier",
		assignedPublishers: ["pub1"],
		availablePublishers: [{ name: "pub2", supplierName: "Other Supplier" }, { name: "Publisher A" }]
	};
</script>

<Template let:args={{ supplierName, assignedPublishers, availablePublishers }}>
	<SupplierPublishersPanelStoryHarness {supplierName} {assignedPublishers} {availablePublishers} />
</Template>

<Story
	name="Interactive"
	args={baseArgs}
	play={async ({ canvasElement, step, userEvent }) => {
		const canvas = within(canvasElement);

		const getRow = (column: "assigned" | "available", publisherName: string) =>
			canvas.getByTestId(
				`publisher-row-${column}-${publisherName
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-+|-+$/g, "")}`
			);

		await step("shows the split publishers layout", async () => {
			await expect(canvas.getByText("Assigned Publishers")).toBeVisible();
			await expect(canvas.getByText("Unassigned publishers")).toBeVisible();
			await expect(canvas.getByPlaceholderText("Search publishers...")).toBeVisible();
		});

		await step("filters and clears the publishers search", async () => {
			const searchInput = canvas.getByPlaceholderText("Search publishers...");
			await userEvent.type(searchInput, "pub1");

			await expect(getRow("assigned", "pub1")).toBeVisible();
			await expect(canvas.queryByTestId("publisher-row-available-pub2")).not.toBeInTheDocument();
			await expect(canvas.queryByTestId("publisher-row-available-publisher-a")).not.toBeInTheDocument();

			await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));
			await expect(getRow("available", "pub2")).toBeVisible();
		});

		await step("removes an assigned publisher", async () => {
			await userEvent.click(within(getRow("assigned", "pub1")).getByRole("button", { name: "Remove" }));

			await waitFor(() => {
				expect(canvas.queryByTestId("publisher-row-assigned-pub1")).not.toBeInTheDocument();
				expect(within(getRow("available", "pub1")).getByRole("button", { name: "Add" })).toBeVisible();
			});
		});

		await step("assigns an unassigned publisher", async () => {
			await userEvent.click(within(getRow("available", "Publisher A")).getByRole("button", { name: "Add" }));

			await waitFor(() => {
				expect(canvas.queryByTestId("publisher-row-available-publisher-a")).not.toBeInTheDocument();
				expect(within(getRow("assigned", "Publisher A")).getByRole("button", { name: "Remove" })).toBeVisible();
			});
		});

		await step("reassigns a publisher after confirmation", async () => {
			await userEvent.click(within(getRow("available", "pub2")).getByRole("button", { name: "Re-assign" }));

			const dialog = canvas.getByRole("dialog");
			await expect(dialog).toBeVisible();
			await expect(dialog).toHaveTextContent(
				"Are you sure you want to remove pub2 from its previous supplier and assign it to Story Supplier?"
			);

			await userEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

			await waitFor(() => {
				expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
				expect(canvas.queryByTestId("publisher-row-available-pub2")).not.toBeInTheDocument();
				expect(within(getRow("assigned", "pub2")).getByRole("button", { name: "Remove" })).toBeVisible();
			});
		});
	}}
/>
