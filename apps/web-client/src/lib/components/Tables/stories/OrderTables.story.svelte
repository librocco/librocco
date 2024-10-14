<script lang="ts">
	import { writable } from "svelte/store";
	import type { Hst } from "@histoire/plugin-svelte";

	import { CustomerOrderTable, SupplierOrderTable } from "../OrderTables";

	export let Hst: Hst;

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
			name: "Penguin Random House",
			email: "p@randoh.com",
			id: "BB-1021921",
			draft: true,
			lastUpdated: "01/01/2024 12:33pm",
			actionLink: ""
		},
		{
			name: "Elsevier",
			email: "elsivier@books.com",
			id: "KK-119281023",
			draft: false,
			lastUpdated: "02/01/2024 17:33pm",
			actionLink: ""
		}
	]);
</script>

<Hst.Story title="Tables / Order Tables">
	<Hst.Variant title="Customers">
		<CustomerOrderTable table={customerTable} />
	</Hst.Variant>
	<Hst.Variant title="Suppliers">
		<SupplierOrderTable data={supplierData} />
	</Hst.Variant>
</Hst.Story>
