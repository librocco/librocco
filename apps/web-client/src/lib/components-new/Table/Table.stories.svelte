<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import Table from "./Table.svelte";
	import TableRow from "./TableRow.svelte";

	export const meta: Meta = {
		title: "Components / Table",
		component: Table
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";

	// Supplier > Orders
	const orderData = [{ id: "order-1", orderId: "#2", supplierName: "BooksRUs", placed: "11/10/2025, 2:15:20 PM" }];

	// Reconciliation
	let reconciliationData = [
		{ isbn: "123", title: "The Great Gatsby", author: "F. Scott Fitzgerald", ordered: 5, delivered: 0 },
		{ isbn: "321", title: "To Kill a Mockingbird", author: "Harper Lee", ordered: 3, delivered: 0 }
	];

	function incrementDelivered(isbn: string) {
		reconciliationData = reconciliationData.map((book) => {
			if (book.isbn === isbn) {
				return { ...book, delivered: book.delivered + 1 };
			}
			return book;
		});
	}

	function decrementDelivered(isbn: string) {
		reconciliationData = reconciliationData.map((book) => {
			if (book.isbn === isbn && book.delivered > 0) {
				return { ...book, delivered: book.delivered - 1 };
			}
			return book;
		});
	}
</script>

<Story name="Supplier Page > Orders">
	<div class="max-w-xl">
		<Table columnWidths={["3", "3", "6"]}>
			<svelte:fragment slot="head-cells">
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left align-middle text-xs">Order ID</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left align-middle text-xs">Supplier Name</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left align-middle text-xs">Placed</th>
			</svelte:fragment>

			<svelte:fragment slot="rows">
				{#each orderData as row}
					<TableRow>
						<td class="px-4 py-2 text-sm">{row.orderId}</td>
						<td class="px-4 py-2 text-sm">{row.supplierName}</td>
						<td class="px-4 py-2 text-sm">{row.placed}</td>
					</TableRow>
				{/each}
			</svelte:fragment>
		</Table>
	</div>
</Story>

<Story name="Supplier Page > Orders (Empty State)">
	<div class="max-w-xl">
		<Table columnWidths={["3", "3", "6"]} showEmptyState={true}>
			<svelte:fragment slot="head-cells">
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">Order ID</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">Supplier Name</th>
				<th scope="col" class="text-muted-foreground w-auto px-4 py-3 text-left text-xs">Placed</th>
			</svelte:fragment>

			<svelte:fragment slot="empty">No orders found</svelte:fragment>
		</Table>
	</div>
</Story>

<Story name="Reconcile Deliveries > Reconciliation">
	<div class="max-w-4xl">
		<div class="mb-2">
			<span class="rounded-md bg-[#f8f8f8] px-2 py-0.5 text-xs font-medium">BooksRUS #1</span>
		</div>
		<Table variant="naked" columnWidths={["2", "3", "4", "2", "2", "2"]}>
			<svelte:fragment slot="head-cells">
				<th scope="col" class="text-muted-foreground px-2 py-1.5 text-start text-xs uppercase tracking-wide">ISBN</th>
				<th scope="col" class="text-muted-foreground px-2 py-1.5 text-start text-xs uppercase tracking-wide">Title</th>
				<th scope="col" class="text-muted-foreground px-2 py-1.5 text-start text-xs uppercase tracking-wide">Author</th>
				<th scope="col" class="text-muted-foreground px-2 py-1.5 text-start text-xs uppercase tracking-wide">Ordered</th>
				<th scope="col" class="text-muted-foreground px-2 py-1.5 text-start text-xs uppercase tracking-wide">Delivered</th>
				<th scope="col" class="text-muted-foreground px-2 py-1.5 text-start text-xs uppercase tracking-wide"
					><span class="sr-only">Delivered Quantity Controls</span></th
				>
			</svelte:fragment>

			<svelte:fragment slot="rows">
				{#each reconciliationData as book (book.isbn)}
					<TableRow variant="naked">
						<td class="line-clamp-1 min-w-0 px-2 py-1.5 text-sm font-medium">{book.isbn}</td>
						<td class="line-clamp-1 min-w-0 px-2 py-1.5 text-sm">{book.title}</td>
						<td class="line-clamp-1 min-w-0 px-2 py-1.5 text-sm">{book.author}</td>
						<td class="px-2 py-1.5 text-start font-semibold">{book.ordered}</td>
						<td class="px-2 py-1.5 text-start font-semibold">{book.delivered}</td>
						<td class="px-2 py-1.5">
							<div class="flex gap-1">
								<button
									on:click={() => decrementDelivered(book.isbn)}
									disabled={book.delivered === 0}
									class="flex h-6 w-6 items-center justify-center rounded border border-neutral-200 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
									aria-label={`Decrease delivered quantity for ${book.title}, currently ${book.delivered}`}
								>
									−</button
								>
								<button
									on:click={() => incrementDelivered(book.isbn)}
									class="flex h-6 w-6 items-center justify-center rounded border border-neutral-200 hover:bg-neutral-200"
									aria-label={`Increase delivered quantity for ${book.title}, currently ${book.delivered}`}
								>
									+</button
								>
							</div>
						</td>
					</TableRow>
				{/each}
			</svelte:fragment>
		</Table>
	</div>
</Story>
