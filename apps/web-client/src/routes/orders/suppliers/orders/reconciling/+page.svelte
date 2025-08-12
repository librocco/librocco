<script lang="ts">
	import type { PageData } from "./$types";
	import ReconcilingTable from "$lib/components/supplier-orders/ReconcilingTable.svelte";

	export let data: PageData;

	$: ({ reconcilingOrders } = data);
</script>

<ReconcilingTable orders={reconcilingOrders} />
