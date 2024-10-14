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
	import type { CustomerOrderData } from "../types";

	const customerData: CustomerOrderData[] = [
		{
			name: "Billy Bob",
			email: "bill@bbob.com",
			id: 1021921,
			surname: "Bob"
		},
		{
			name: "Kim K",
			email: "kim@spills-it.com",
			id: 119281023,
			surname: "Kardashian"
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
