<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import { Button, ButtonColor } from '../../Button';

	import InventoryTable from '../InventoryTable.svelte';

	import { createTable } from '../table';

	import { rows } from '../__tests__/data';

	export let Hst: Hst;

	const defaultStockTable = createTable({ rows });
</script>

<Hst.Story title="Tables / Inventory Table (Stock & In Note)">
	<div class="flex flex-col gap-y-4">
		<div class="w-24 p-1">
			<Button color={ButtonColor.Primary} on:click={() => defaultStockTable.addRows([rows[0]])}>Add row</Button>
		</div>

		<InventoryTable table={defaultStockTable} />
	</div>
</Hst.Story>
