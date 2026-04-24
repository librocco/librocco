<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";

	import SupplierPublishersPanelStoryHarnessComponent from "./SupplierPublishersPanelStoryHarness.svelte";

	export const meta: Meta = {
		title: "Routes/Orders/Suppliers/Publisher Panel",
		component: SupplierPublishersPanelStoryHarnessComponent,
		parameters: {
			controls: {
				disable: true
			}
		}
	};
</script>

<script lang="ts">
	import { expect, waitFor, within } from "storybook/test";

	import { Story, Template } from "@storybook/addon-svelte-csf";

	import SupplierPublishersPanelStoryHarness from "./SupplierPublishersPanelStoryHarness.svelte";

	type AvailablePublisher = {
		name: string;
		supplierName?: string;
	};

	type StoryArgs = {
		supplierName: string;
		assignedPublishers: string[];
		availablePublishers: AvailablePublisher[];
	};

	const baseArgs = {
		supplierName: "Story Supplier",
		assignedPublishers: ["pub1"],
		availablePublishers: [{ name: "pub2", supplierName: "Other Supplier" }, { name: "Publisher A" }]
	} satisfies StoryArgs;

	type PublisherColumn = "assigned" | "available";

	const emptyArgs = {
		supplierName: "Story Supplier",
		assignedPublishers: [],
		availablePublishers: []
	} satisfies StoryArgs;

	const publisherRowTestId = (column: PublisherColumn, publisherName: string) =>
		`publisher-row-${column}-${publisherName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")}`;

	const buildStoryApi = (canvasElement: HTMLElement) => {
		const canvas = within(canvasElement);
		const documentBody = within(canvasElement.ownerDocument.body);

		return {
			canvas,
			documentBody,
			getPanel: (column: PublisherColumn) => canvas.getByTestId(`publisher-panel-${column}`),
			getCount: (column: PublisherColumn) => canvas.getByTestId(`publisher-count-${column}`),
			getRow: (column: PublisherColumn, publisherName: string) => canvas.getByTestId(publisherRowTestId(column, publisherName)),
			getSearchInput: () => canvas.getByPlaceholderText("Search publishers...")
		};
	};
</script>

<Template let:args>
	<SupplierPublishersPanelStoryHarness {...args} />
</Template>

<Story
	name="Search"
	args={baseArgs}
	tags={["test-only"]}
	play={async ({ canvasElement, step, userEvent }) => {
		const { canvas, getCount, getPanel, getRow, getSearchInput } = buildStoryApi(canvasElement);

		await step("shows the split publishers layout and badge counts", async () => {
			await expect(canvas.getByText("Assigned Publishers")).toBeVisible();
			await expect(canvas.getByText("Unassigned publishers")).toBeVisible();
			await expect(getSearchInput()).toBeVisible();
			await expect(getCount("assigned")).toHaveTextContent("1");
			await expect(getCount("available")).toHaveTextContent("2");
		});

		await step("filters publishers and shows matching empty states", async () => {
			await userEvent.type(getSearchInput(), "pub1");

			await expect(getRow("assigned", "pub1")).toBeVisible();
			await expect(within(getPanel("available")).getByText("No matching available publishers")).toBeVisible();
			await expect(getCount("assigned")).toHaveTextContent("1");
			await expect(getCount("available")).toHaveTextContent("0");

			await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));
			await expect(getRow("available", "pub2")).toBeVisible();
			await expect(getCount("assigned")).toHaveTextContent("1");
			await expect(getCount("available")).toHaveTextContent("2");

			await userEvent.type(getSearchInput(), "zzz");
			await expect(within(getPanel("assigned")).getByText("No matching assigned publishers")).toBeVisible();
			await expect(within(getPanel("available")).getByText("No matching available publishers")).toBeVisible();
			await expect(getCount("assigned")).toHaveTextContent("0");
			await expect(getCount("available")).toHaveTextContent("0");

			await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));
			await expect(getRow("assigned", "pub1")).toBeVisible();
			await expect(getRow("available", "Publisher A")).toBeVisible();
			await expect(getCount("assigned")).toHaveTextContent("1");
			await expect(getCount("available")).toHaveTextContent("2");
		});
	}}
/>

<Story
	name="RemoveAssigned"
	args={baseArgs}
	tags={["test-only"]}
	play={async ({ canvasElement, step, userEvent }) => {
		const { canvas, getCount, getPanel, getRow } = buildStoryApi(canvasElement);

		await step("removes an assigned publisher and exposes the empty state", async () => {
			await userEvent.click(within(getRow("assigned", "pub1")).getByRole("button", { name: "Remove" }));

			await waitFor(() => {
				expect(canvas.queryByTestId(publisherRowTestId("assigned", "pub1"))).not.toBeInTheDocument();
				expect(within(getRow("available", "pub1")).getByRole("button", { name: "Add" })).toBeVisible();
			});

			await expect(within(getPanel("assigned")).getByText("No assigned publishers")).toBeVisible();
			await expect(getCount("assigned")).toHaveTextContent("0");
			await expect(getCount("available")).toHaveTextContent("3");
		});
	}}
/>

<Story
	name="AddUnassigned"
	args={baseArgs}
	tags={["test-only"]}
	play={async ({ canvasElement, step, userEvent }) => {
		const { canvas, getCount, getRow } = buildStoryApi(canvasElement);

		await step("assigns an unassigned publisher", async () => {
			await userEvent.click(within(getRow("available", "Publisher A")).getByRole("button", { name: "Add" }));

			await waitFor(() => {
				expect(canvas.queryByTestId(publisherRowTestId("available", "Publisher A"))).not.toBeInTheDocument();
				expect(within(getRow("assigned", "Publisher A")).getByRole("button", { name: "Remove" })).toBeVisible();
			});

			await expect(getCount("assigned")).toHaveTextContent("2");
			await expect(getCount("available")).toHaveTextContent("1");
		});
	}}
/>

<Story
	name="ReassignWithConfirm"
	args={baseArgs}
	tags={["test-only"]}
	play={async ({ canvasElement, step, userEvent }) => {
		const { canvas, documentBody, getCount, getRow } = buildStoryApi(canvasElement);

		await step("reassigns a publisher after confirmation", async () => {
			await userEvent.click(within(getRow("available", "pub2")).getByRole("button", { name: "Re-assign" }));

			await waitFor(() => {
				expect(documentBody.getByRole("dialog")).toHaveTextContent(
					"Are you sure you want to remove pub2 from its previous supplier and assign it to Story Supplier?"
				);
			});

			const dialog = documentBody.getByRole("dialog");
			await userEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

			await waitFor(() => {
				expect(documentBody.queryByRole("dialog")).not.toBeInTheDocument();
				expect(canvas.queryByTestId(publisherRowTestId("available", "pub2"))).not.toBeInTheDocument();
				expect(within(getRow("assigned", "pub2")).getByRole("button", { name: "Remove" })).toBeVisible();
			});

			await expect(getCount("assigned")).toHaveTextContent("2");
			await expect(getCount("available")).toHaveTextContent("1");
		});
	}}
/>

<Story
	name="ReassignCancel"
	args={baseArgs}
	tags={["test-only"]}
	play={async ({ canvasElement, step, userEvent }) => {
		const { canvas, documentBody, getCount, getRow } = buildStoryApi(canvasElement);

		await step("cancels a reassignment without mutating either list", async () => {
			await userEvent.click(within(getRow("available", "pub2")).getByRole("button", { name: "Re-assign" }));

			await waitFor(() => {
				expect(documentBody.getByRole("dialog")).toBeVisible();
			});

			const dialog = documentBody.getByRole("dialog");
			await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

			await waitFor(() => {
				expect(documentBody.queryByRole("dialog")).not.toBeInTheDocument();
			});

			await expect(within(getRow("available", "pub2")).getByRole("button", { name: "Re-assign" })).toBeVisible();
			await expect(canvas.queryByTestId(publisherRowTestId("assigned", "pub2"))).not.toBeInTheDocument();
			await expect(getCount("assigned")).toHaveTextContent("1");
			await expect(getCount("available")).toHaveTextContent("2");
		});
	}}
/>

<Story
	name="EmptyState"
	args={emptyArgs}
	tags={["test-only"]}
	play={async ({ canvasElement, step }) => {
		const { getCount, getPanel } = buildStoryApi(canvasElement);

		await step("shows both empty state messages with zero badges", async () => {
			await expect(within(getPanel("assigned")).getByText("No assigned publishers")).toBeVisible();
			await expect(within(getPanel("available")).getByText("No available publishers")).toBeVisible();
			await expect(getCount("assigned")).toHaveTextContent("0");
			await expect(getCount("available")).toHaveTextContent("0");
		});
	}}
/>
