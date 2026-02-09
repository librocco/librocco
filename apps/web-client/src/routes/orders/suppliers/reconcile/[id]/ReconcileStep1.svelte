<script lang="ts">
	import DaisyUIScannerForm from "$lib/forms/DaisyUIScannerForm.svelte";
	import Table from "$lib/components-new/Table/Table.svelte";
	import TableRow from "$lib/components-new/Table/TableRow.svelte";
	import CounterBadge from "$lib/components-new/CounterBadge/CounterBadge.svelte";
	import ArrowRight from "$lucide/arrow-right";

	import type { PlacedSupplierOrderLine, ReconciliationOrderLine } from "$lib/db/cr-sqlite/types";

	interface BookWithDelivery {
		isbn: string;
		title: string;
		author: string;
		ordered: number;
		delivered: number;
	}

	interface SupplierOrderGroup {
		supplierOrderId: string;
		supplierName: string;
		books: BookWithDelivery[];
	}

	export let placedOrderLines: PlacedSupplierOrderLine[];
	export let reconciliationOrderLines: ReconciliationOrderLine[];
	export let onScan: (isbn: string) => Promise<void> | void;
	export let onDecrement: (isbn: string) => Promise<void> | void;
	export let onIncrement: (isbn: string) => Promise<void> | void;
	export let onContinue: () => void;

	$: groupedBooks = Array.from(
		new Map(
			placedOrderLines.map((line) => [
				line.supplier_order_id,
				{
					supplierOrderId: line.supplier_order_id,
					supplierName: line.supplier_name,
					books: [] as BookWithDelivery[]
				}
			])
		).entries()
	).map(([supplierOrderId, group]) => ({
		...group,
		books: Array.from(
			new Map(
				placedOrderLines
					.filter((line) => line.supplier_order_id === supplierOrderId)
					.map((line) => {
						const deliveredLine = reconciliationOrderLines.find((l) => l.isbn === line.isbn);
						return [
							line.isbn,
							{
								isbn: line.isbn,
								title: line.title || "",
								author: line.authors || "",
								ordered: line.quantity,
								delivered: deliveredLine ? deliveredLine.quantity : 0
							}
						];
					})
			).values()
		)
	}));

	$: totalOrdered = placedOrderLines.reduce((sum, line) => sum + line.quantity, 0);

	$: totalDelivered = reconciliationOrderLines.reduce((sum, line) => sum + line.quantity, 0);

	$: totalScanned = new Set(reconciliationOrderLines.map((line) => line.isbn)).size;

	function getDeliveredColorClass(ordered: number, delivered: number): string {
		if (delivered === 0) {
			return "text-foreground";
		} else if (delivered < ordered) {
			return "text-warning";
		} else if (delivered === ordered) {
			return "text-success";
		} else {
			return "text-destructive";
		}
	}
</script>

<div class="flex flex-1 flex-col overflow-hidden">
	<div class="shrink-0 border-b border-neutral-200 bg-white">
		<div class="px-6 py-4">
			<div class="space-y-4">
				<DaisyUIScannerForm onSubmit={onScan} />
			</div>
		</div>
	</div>

	<div class="flex h-full flex-col space-y-4 overflow-hidden bg-white px-6 py-4">
		<div class="flex gap-3">
			<CounterBadge label="Total Ordered" value={totalOrdered} />
			<CounterBadge label="Total Delivered" value={totalDelivered} />
		</div>

		<div class="h-full overflow-y-auto">
			{#each groupedBooks as supplierOrder (supplierOrder.supplierOrderId)}
				<div class="mb-4">
					<div class="-mb-6">
						<span class="text-foreground rounded-md bg-[#f8f8f8] px-2 py-0.5 text-xs font-medium">
							{supplierOrder.supplierName} # {supplierOrder.supplierOrderId}
						</span>
					</div>
					<Table variant="naked" columnWidths={["2", "3", "4", "2", "2", "2"]}>
						<svelte:fragment slot="head-cells">
							<th scope="col" class="text-muted-foreground px-2 py-1.5 text-left text-xs uppercase tracking-wide"> ISBN </th>
							<th scope="col" class="text-muted-foreground px-2 py-1.5 text-left text-xs uppercase tracking-wide"> Title </th>
							<th scope="col" class="text-muted-foreground px-2 py-1.5 text-left text-xs uppercase tracking-wide"> Author </th>
							<th scope="col" class="text-muted-foreground w-20 px-2 py-1.5 text-left text-xs uppercase tracking-wide"> Ordered </th>
							<th scope="col" class="text-muted-foreground w-32 px-2 py-1.5 text-left text-xs uppercase tracking-wide"> Delivered </th>
							<th scope="col" class="text-muted-foreground w-32 px-2 py-1.5 text-left text-xs uppercase tracking-wide">
								<span class="sr-only">Delivered Quantity Controls</span>
							</th>
						</svelte:fragment>

						<svelte:fragment slot="rows">
							{#each supplierOrder.books as book (book.isbn)}
								{@const isLastBook = book === supplierOrder.books[supplierOrder.books.length - 1]}
								{@const deliveredColor = getDeliveredColorClass(book.ordered, book.delivered)}
								<TableRow
									variant="naked"
									className="hover:bg-neutral-50 transition-all duration-[120ms] {isLastBook ? '' : 'border-b border-neutral-100'}"
								>
									<td class="text-foreground w-32 min-w-0 shrink-0 px-2 py-1.5 align-middle text-sm font-medium">
										{book.isbn}
									</td>
									<td class="text-foreground w-32 min-w-0 truncate px-2 py-1.5 align-middle text-sm">
										{book.title}
									</td>
									<td class="text-foreground min-w-0 flex-1 truncate px-2 py-1.5 align-middle text-sm">
										{book.author}
									</td>
									<td class="text-foreground w-20 px-2 py-1.5 text-start align-middle text-sm font-medium">
										{book.ordered}
									</td>
									<td class="flex items-center justify-between gap-2 px-2 py-1.5">
										<span class="text-sm font-semibold {deliveredColor}">
											{book.delivered}
										</span>
										<div class="flex gap-1">
											<button
												on:click={() => onDecrement(book.isbn)}
												disabled={book.delivered === 0}
												class="flex h-6 w-6 items-center justify-center rounded border border-neutral-200 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
												aria-label={`Decrease delivered quantity for ${book.title}, currently ${book.delivered}`}
											>
												−
											</button>
											<button
												on:click={() => onIncrement(book.isbn)}
												class="flex h-6 w-6 items-center justify-center rounded border border-neutral-200 transition-colors hover:bg-neutral-200"
												aria-label={`Increase delivered quantity for ${book.title}, currently ${book.delivered}`}
											>
												+
											</button>
										</div>
									</td>
								</TableRow>
							{/each}
						</svelte:fragment>
					</Table>
				</div>
			{/each}
		</div>
	</div>

	{#if totalScanned > 0}
		<div class="shrink-0 border-t border-neutral-200 bg-neutral-50 px-6 py-4">
			<div class="flex items-center justify-between">
				<div class="text-sm text-zinc-900">
					Total books scanned: <span class="font-medium">{totalScanned}</span>
				</div>
				<button
					on:click={onContinue}
					class="flex items-center gap-2 rounded-md bg-zinc-900 px-6 py-2 text-white transition-colors hover:bg-zinc-800"
				>
					Continue
					<ArrowRight aria-hidden />
				</button>
			</div>
		</div>
	{/if}
</div>
