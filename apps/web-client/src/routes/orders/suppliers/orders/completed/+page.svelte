<script lang="ts">
	import type { PageData } from "./$types";
	import CompletedTable from "$lib/components/supplier-orders/CompletedTable.svelte";

	export let data: PageData;

	$: ({ completedOrders } = data);
</script>

<CompletedTable orders={completedOrders} />
