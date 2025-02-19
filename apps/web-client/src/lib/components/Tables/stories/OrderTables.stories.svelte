<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import { CustomerOrderTable, SupplierTable } from "../OrderTables";

	export const meta: Meta = {
		title: "Tables / Order tables",
		subcomponents: { CustomerOrderTable, SupplierTable }
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";

	import type { SupplierExtended } from "$lib/db/cr-sqlite/types";
	import type { CustomerOrderSchema } from "$lib/forms/schemas";

	import { writable } from "svelte/store";

	import { createTable } from "$lib/actions";

	const customerData: Required<CustomerOrderSchema>[] = [
		{
			fullname: "Billy Bob",
			email: "bill@bbob.com",
			id: 10219,
			displayId: "10219",
			deposit: 100
		},
		{
			fullname: "Kim K",
			email: "kim@spills-it.com",
			id: 11928,
			displayId: "11928",
			deposit: 200
		}
	];

	const customerTable = createTable(
		writable({
			data: customerData
		})
	);

	const supplierData = writable<SupplierExtended[]>([
		{
			id: 1,
			name: "Supplier 1",
			email: "info@sup.plier",
			address: "1234 Main St",
			numPublishers: 2
		},
		{
			id: 2,
			name: "Supplier 2",
			email: "contact@elm.st",
			address: "5678 Elm St",
			numPublishers: 0
		}
	]);
</script>

<Story name="Customers">
	<CustomerOrderTable table={customerTable} />
</Story>

<Story name="Suppliers">
	<SupplierTable data={supplierData}>
		<div slot="row-actions">
			<button class="btn-outline btn-sm btn">Delete</button>
			<button class="btn-outline btn-sm btn">Edit</button>
		</div>
	</SupplierTable>
</Story>
