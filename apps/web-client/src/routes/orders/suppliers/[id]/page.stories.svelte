<script module lang="ts">
	import { defineMeta } from "@storybook/addon-svelte-csf";
	import { expect, waitFor, within } from "storybook/test";
	import { type ComponentProps } from "svelte";

	import { createTestContext } from "$lib/app/test";
	import { getDb } from "$lib/app/db";
	import { associatePublisher, upsertSupplier } from "$lib/db/cr-sqlite/suppliers";

	import SupplierPage from "./+page.svelte";
	import { load } from "./+page";
	import { upsertBook } from "$lib/db/cr-sqlite/books";
	import type { DBAsync } from "@vlcn.io/xplat-api";

	type Args = ComponentProps<typeof SupplierPage>;
	type LoadInput = Parameters<typeof load>[0];
	type LoadData = Awaited<ReturnType<typeof load>>;

	export const { Story } = defineMeta({
		title: "Routes/Orders/Suppliers/[id]/Page",
		component: SupplierPage,
		args: { data: {} as Args["data"] }
	});

	const setupTest = (cb: (db: DBAsync) => Promise<{ params: { id: string } }>) => async () => {
		const { app, plugins } = await createTestContext();
		const db = await getDb(app);

		const { params } = await cb(db);

		const parent: LoadInput["parent"] = async () => ({ app, plugins });
		const data = (await load({ params, parent } as LoadInput)) as LoadData;

		return { data: { ...data, app, plugins } } as Args;
	};

	const setupPublishersView = setupTest(async (db) => {
		const supplierId = 1001;
		const otherSupplierId = 1002;

		await upsertSupplier(db, { id: supplierId, name: "Story Supplier" });
		await upsertSupplier(db, { id: otherSupplierId, name: "Other Supplier" });

		await upsertBook(db, { isbn: "1", title: "Book pub1", publisher: "pub1" } as any);
		await upsertBook(db, { isbn: "2", title: "Book pub2", publisher: "pub2" } as any);
		await upsertBook(db, { isbn: "978-0-306-40615-7", title: "Book A", authors: "Author A", publisher: "Publisher A" } as any);

		await associatePublisher(db, supplierId, "pub1");
		await associatePublisher(db, otherSupplierId, "pub2");

		return { params: { id: String(supplierId) } };
	});

	const openPublishersTab = async (canvas: any, userEvent: any) => {
		await userEvent.click(canvas.getByRole("button", { name: "Assigned Publishers" }));
	};

	const getPublisherRow = (canvas: any, publisher: string) => {
		const row = canvas.getByText(publisher).closest("div");
		if (!row) throw new Error(`Row for '${publisher}' not found`);
		return row as HTMLElement;
	};
</script>

{#snippet template(args: Args, context: any)}
	{@const loaded = context.loaded as Partial<Args>}
	<SupplierPage data={{ ...args.data, ...(loaded.data ?? {}) }} />
{/snippet}

<Story
	name="Loaded"
	{template}
	loaders={[
		setupTest(async (db) => {
			const supplierId = 1001;

			await upsertSupplier(db, {
				id: supplierId,
				name: "Story Supplier"
			});
			await upsertBook(db, { isbn: "1", publisher: "publiher 1" } as any);

			return { params: { id: String(supplierId) } };
		})
	]}
/>

<Story
	name="Publishers - split column layout"
	{template}
	loaders={[setupPublishersView]}
	play={async ({ canvas, userEvent }) => {
		await openPublishersTab(canvas, userEvent);

		const assignedTitles = canvas.getAllByText("Assigned Publishers");
		expect(assignedTitles.length).toBeGreaterThan(1);
		await expect(canvas.getByText("Unassigned publishers")).toBeVisible();
	}}
/>

<Story
	name="Publishers - search input is visible"
	{template}
	loaders={[setupPublishersView]}
	play={async ({ canvas, userEvent }) => {
		await openPublishersTab(canvas, userEvent);
		await expect(canvas.getByPlaceholderText("Search publishers...")).toBeVisible();
	}}
/>

<Story
	name="Publishers - initial assigned and unassigned lists"
	{template}
	loaders={[setupPublishersView]}
	play={async ({ canvas, userEvent }) => {
		await openPublishersTab(canvas, userEvent);

		const pub1Row = within(getPublisherRow(canvas, "pub1"));
		await expect(pub1Row.getByRole("button", { name: "Remove" })).toBeVisible();

		const publisherARow = within(getPublisherRow(canvas, "Publisher A"));
		await expect(publisherARow.getByRole("button", { name: "Add" })).toBeVisible();

		const pub2Row = within(getPublisherRow(canvas, "pub2"));
		await expect(pub2Row.getByRole("button", { name: "Re-assign" })).toBeVisible();
	}}
/>

<Story
	name="Publishers - search filters list"
	{template}
	loaders={[setupPublishersView]}
	play={async ({ canvas, userEvent }) => {
		await openPublishersTab(canvas, userEvent);

		const searchInput = canvas.getByPlaceholderText("Search publishers...");
		await userEvent.type(searchInput, "pub1");

		await expect(canvas.getByText("pub1")).toBeVisible();
		await expect(canvas.queryByText("pub2")).not.toBeInTheDocument();
		await expect(canvas.queryByText("Publisher A")).not.toBeInTheDocument();
	}}
/>

<Story
	name="Publishers - clear search restores list"
	{template}
	loaders={[setupPublishersView]}
	play={async ({ canvas, userEvent }) => {
		await openPublishersTab(canvas, userEvent);

		const searchInput = canvas.getByPlaceholderText("Search publishers...");
		await userEvent.type(searchInput, "pub1");
		await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));

		await expect(canvas.getByText("pub2")).toBeVisible();
	}}
/>

<Story
	name="Publishers - remove unassigns publisher"
	{template}
	loaders={[setupPublishersView]}
	play={async ({ canvas, userEvent }) => {
		await openPublishersTab(canvas, userEvent);

		const pub1RowBefore = within(getPublisherRow(canvas, "pub1"));
		await userEvent.click(pub1RowBefore.getByRole("button", { name: "Remove" }));

		await waitFor(() => {
			const pub1RowAfter = within(getPublisherRow(canvas, "pub1"));
			expect(pub1RowAfter.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
			expect(pub1RowAfter.getByRole("button", { name: "Add" })).toBeVisible();
		});
	}}
/>

<Story
	name="Publishers - reassign dialog confirmation"
	{template}
	loaders={[setupPublishersView]}
	play={async ({ canvas, userEvent }) => {
		await openPublishersTab(canvas, userEvent);

		const pub2Row = within(getPublisherRow(canvas, "pub2"));
		await userEvent.click(pub2Row.getByRole("button", { name: "Re-assign" }));

		const dialog = canvas.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(dialog).toHaveTextContent(
			"Are you sure you want to remove pub2 from its previous supplier and assign it to Story Supplier?"
		);

		await userEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

		await waitFor(async () => {
			await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
			const pub2RowAfter = within(getPublisherRow(canvas, "pub2"));
			await expect(pub2RowAfter.getByRole("button", { name: "Remove" })).toBeVisible();
		});
	}}
/>
