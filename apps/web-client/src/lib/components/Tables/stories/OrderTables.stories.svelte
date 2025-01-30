<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import { CustomerOrderTable, SupplierOrderTable } from "../OrderTables";

	export const meta: Meta = {
		title: "Tables / Order tables",
		subcomponents: { CustomerOrderTable, SupplierOrderTable }
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";

	import { writable } from "svelte/store";

	import { createTable } from "$lib/actions";
	import type { CustomerOrderSchema } from "$lib/forms/schemas";

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

	const supplierData = writable([
		{
			id: 1,
			supplierId: 1,
			supplierName: "Supplier 1",
			totalBooks: 34,
			placedAt: null,
			actionLink: ""
		},
		{
			id: 2,
			supplierId: 1,
			supplierName: "Supplier 2",
			totalBooks: 34,
			placedAt: "02/01/2024 17:33pm",
			actionLink: ""
		}
	]);
</script>

<Story name="Customers">
	<CustomerOrderTable table={customerTable} />
</Story>

<Story name="Suppliers">
	<SupplierOrderTable data={supplierData} />
</Story>
