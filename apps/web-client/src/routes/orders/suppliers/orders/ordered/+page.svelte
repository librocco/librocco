<script lang="ts">
	import { getContext } from "svelte";
	import type { PageData } from "./$types";
	import { appHash } from "$lib/paths";
	import OrderedTable from "$lib/components/supplier-orders/OrderedTable.svelte";
	import { createReconciliationOrder } from "$lib/db/cr-sqlite/order-reconciliation";

	export let data: PageData;

	const goto = getContext<(url: string) => Promise<void>>("goto");

	$: ({ placedOrders } = data);
	$: db = data?.dbCtx?.db;

	async function handleReconcile(event: CustomEvent<{ supplierOrderIds: number[] }>) {
		const id = Math.floor(Math.random() * 1000000); // Temporary ID generation
		await createReconciliationOrder(db, id, event.detail.supplierOrderIds);
		goto(appHash("reconcile", id));
	}
</script>

<OrderedTable orders={placedOrders} on:reconcile={handleReconcile} />
