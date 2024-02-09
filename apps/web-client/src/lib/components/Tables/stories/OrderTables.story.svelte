<script lang="ts">
	import { writable } from "svelte/store";
	import type { Hst } from "@histoire/plugin-svelte";

	import { CustomerOrderTable, SupplierOrderTable } from "../OrderTables";

	export let Hst: Hst;

	const customerData = writable([
		{
			name: "Billy Bob",
			email: "bill@bbob.com",
			id: "BB-1021921",
			lastUpdated: "01/01/2024 12:33pm",
			actionLink: ""
		},
		{
			name: "Kim K",
			email: "kim@spills-it.com",
			id: "KK-119281023",
			lastUpdated: "02/01/2024 17:33pm",
			actionLink: ""
		}
	]);

	const supplierData = writable([
		{
			name: "Penguin Random House",
			email: "p@randoh.com",
			id: "BB-1021921",
			lastUpdated: "01/01/2024 12:33pm",
			actionLink: ""
		},
		{
			name: "Elsevier",
			email: "elsivier@books.com",
			id: "KK-119281023",
			lastUpdated: "02/01/2024 17:33pm",
			actionLink: ""
		}
	]);
</script>

<Hst.Story title="Tables / Order Tables">
	<Hst.Variant title="Customers">
		<CustomerOrderTable data={customerData} />
	</Hst.Variant>
	<Hst.Variant title="Suppliers">
		<SupplierOrderTable data={supplierData} />
	</Hst.Variant>
</Hst.Story>
