import type { Meta, StoryObj } from "@storybook/sveltekit";
import { expect, waitFor, within } from "storybook/test";
import type { ComponentProps } from "svelte";

import { createTestContext } from "$lib/app/test";
import { getDb } from "$lib/app/db";
import { upsertBook } from "$lib/db/cr-sqlite/books";
import { associatePublisher, upsertSupplier } from "$lib/db/cr-sqlite/suppliers";

import type { DBAsync } from "@vlcn.io/xplat-api";

import { load } from "./+page";
import SupplierPage from "./+page.svelte";

type Args = ComponentProps<typeof SupplierPage>;
type LoadInput = Parameters<typeof load>[0];
type LoadData = Awaited<ReturnType<typeof load>>;

const meta = {
	title: "Routes/Orders/Suppliers/[id]/Page",
	component: SupplierPage,
	args: { data: {} as Args["data"] },
	render: (args, { loaded }) => ({
		Component: SupplierPage,
		props: {
			...args,
			data: {
				...args.data,
				...(loaded?.data ?? {})
			}
		}
	})
} satisfies Meta<typeof SupplierPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Wrap the callback to set up state before the test and load the data using the page load function
 */
const setupTest = (cb: (db: DBAsync) => Promise<{ params: { id: string } }>) => async () => {
	const { app, plugins } = await createTestContext();
	const db = await getDb(app);

	const { params } = await cb(db);

	const parent: LoadInput["parent"] = async () => ({ app, plugins });
	const data = (await load({ params, parent } as LoadInput)) as LoadData;

	return { data: { ...data, app, plugins } } as Args;
};

// Fixture setup
const setupPublishersView = setupTest(async (db) => {
	const supplierId = 1001;
	const otherSupplierId = 1002;

	await upsertSupplier(db, { id: supplierId, name: "Story Supplier" });
	await upsertSupplier(db, { id: otherSupplierId, name: "Other Supplier" });

	// Add publishers (by adding books published by them)
	await upsertBook(db, { isbn: "1", title: "Book pub1", publisher: "pub1" } as never);
	await upsertBook(db, { isbn: "2", title: "Book pub2", publisher: "pub2" } as never);
	await upsertBook(db, { isbn: "978-0-306-40615-7", title: "Book A", authors: "Author A", publisher: "pub3" } as never);

	await associatePublisher(db, supplierId, "pub1");
	await associatePublisher(db, otherSupplierId, "pub2");

	return { params: { id: String(supplierId) } };
});

const openPublishersTab = async (
	canvas: Parameters<NonNullable<Story["play"]>>[0]["canvas"],
	userEvent: Parameters<NonNullable<Story["play"]>>[0]["userEvent"]
) => {
	await userEvent.click(canvas.getByRole("button", { name: "Assigned Publishers" }));
};

const getPublisherRow = (canvas: Parameters<NonNullable<Story["play"]>>[0]["canvas"], publisher: string) => {
	const row = canvas.getByText(publisher).closest("div");
	if (!row) throw new Error(`Row for '${publisher}' not found`);
	return row as HTMLElement;
};

export const Loaded: Story = {
	loaders: [
		setupTest(async (db) => {
			const supplierId = 1001;

			await upsertSupplier(db, {
				id: supplierId,
				name: "Story Supplier"
			});
			await upsertBook(db, { isbn: "1", publisher: "publiher 1" } as never);

			return { params: { id: String(supplierId) } };
		})
	]
};

export const PublishersInitialAssignedAndUnassignedLists: Story = {
	name: "Publishers - initial assigned and unassigned lists",
	loaders: [setupPublishersView],
	play: async ({ canvas, userEvent }) => {
		await openPublishersTab(canvas, userEvent);

		const pub1Row = within(getPublisherRow(canvas, "pub1"));
		await expect(pub1Row.getByRole("button", { name: "Remove" })).toBeVisible();

		const publisherARow = within(getPublisherRow(canvas, "Publisher A"));
		await expect(publisherARow.getByRole("button", { name: "Add" })).toBeVisible();

		const pub2Row = within(getPublisherRow(canvas, "pub2"));
		await expect(pub2Row.getByRole("button", { name: "Re-assign" })).toBeVisible();
	}
};

export const PublishersSearchFiltersList: Story = {
	name: "Publishers - search filters list",
	loaders: [setupPublishersView],
	play: async ({ canvas, userEvent }) => {
		await openPublishersTab(canvas, userEvent);

		const searchInput = canvas.getByPlaceholderText("Search publishers...");
		await userEvent.type(searchInput, "pub1");

		await expect(canvas.getByText("pub1")).toBeVisible();
		await expect(canvas.queryByText("pub2")).not.toBeInTheDocument();
		await expect(canvas.queryByText("Publisher A")).not.toBeInTheDocument();
	}
};

export const PublishersClearSearchRestoresList: Story = {
	name: "Publishers - clear search restores list",
	loaders: [setupPublishersView],
	play: async ({ canvas, userEvent }) => {
		await openPublishersTab(canvas, userEvent);

		const searchInput = canvas.getByPlaceholderText("Search publishers...");
		await userEvent.type(searchInput, "pub1");
		await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));

		await expect(canvas.getByText("pub2")).toBeVisible();
	}
};

export const PublishersRemoveUnassignsPublisher: Story = {
	name: "Publishers - remove unassigns publisher",
	loaders: [setupPublishersView],
	play: async ({ canvas, userEvent }) => {
		await openPublishersTab(canvas, userEvent);

		// Remove the (assigned) publisher
		const pub1RowBefore = within(getPublisherRow(canvas, "pub1"));
		await userEvent.click(pub1RowBefore.getByRole("button", { name: "Remove" }));

		// The publisher is removed from assigned list (no remove button)
		await waitFor(() => {
			const pub1RowAfter = within(getPublisherRow(canvas, "pub1"));
			expect(pub1RowAfter.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
		});

		// The publisher appears in unassigned list (has add button)
		const pub1RowAfter = within(getPublisherRow(canvas, "pub1"));
		await expect(pub1RowAfter.getByRole("button", { name: "Add" })).toBeVisible();
	}
};

export const PublishersRemoveUnassignsPublisher: Story = {
	name: "Publishers - add assigns publisher",
	loaders: [setupPublishersView],
	play: async ({ canvas, userEvent }) => {
		await openPublishersTab(canvas, userEvent);

		// Assign the publisher
		// NOTE: pub3 is not assigned to any supplier -- no confirmation prompt
		const pub3RowBefore = within(getPublisherRow(canvas, "pub3"));
		await userEvent.click(pub3RowBefore.getByRole("button", { name: "Add" }));

		// The publisher is removed from available (unassigned) list (no add button)
		await waitFor(() => {
			const pub3RowAfter = within(getPublisherRow(canvas, "pub3"));
			expect(pub3RowAfter.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
		});

		// The publisher appears in assigned list (has add button)
		const pub3RowAfter = within(getPublisherRow(canvas, "pub3"));
		await expect(pub3RowAfter.getByRole("button", { name: "Add" })).toBeVisible();
	}
};

export const PublishersReassignDialogConfirmation: Story = {
	name: "Publishers - reassign dialog confirmation",
	loaders: [setupPublishersView],
	play: async ({ canvas, userEvent }) => {
		await openPublishersTab(canvas, userEvent);

		// Re-Assign the publisher
		// NOTE: pub2 is assigned to supplier 2 -- prompt confirmation required for re-assignment
		const pub2Row = within(getPublisherRow(canvas, "pub2"));
		await userEvent.click(pub2Row.getByRole("button", { name: "Re-assign" }));

		const dialogText = "Are you sure you want to remove pub2 from its previous supplier and assign it to Story Supplier?";
		const dialogTitle = await within(document.body).findByRole("heading", { name: "Re-assign publisher" });
		const modalBox = dialogTitle.closest(".modal-box");
		if (!modalBox) throw new Error("Modal box not found");

		await waitFor(() => {
			expect(modalBox).toHaveTextContent(dialogText);
		});

		await userEvent.click(within(modalBox as HTMLElement).getByRole("button", { name: "Confirm" }));

		await waitFor(() => {
			const pub2RowAfter = within(getPublisherRow(canvas, "pub2"));
			expect(pub2RowAfter.getByRole("button", { name: "Remove" })).toBeVisible();
		});
	}
};
