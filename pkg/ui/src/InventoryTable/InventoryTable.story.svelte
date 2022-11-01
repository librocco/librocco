<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';
	import { InventoryRow, InventoryTable } from './index';
	import type { TableData } from './types';
	export let Hst: Hst;

	const data: TableData[] = [
		{
			ISBN: 917289012312,
			Title: 'Miti Del Nord',
			Author: 'Neil Gaiman',
			Editor: 'N/A',
			Quantity: 3,
			Price: 10,
			Year: 2017,
			OutOfPrint: false,
			EditedBy: '',
			Classification: ''
		},
		{
			ISBN: 917289012312,
			Title: 'Hellenistic history and culture',
			Author: 'Peter Green',
			Editor: 'N/A',
			Quantity: 3,
			Price: 10,
			Year: 2017,
			OutOfPrint: false,
			EditedBy: '',
			Classification: ''
		},

		{
			ISBN: 917289012310,
			Title: 'Studies in Greek culture and Roman policy',
			Author: 'Robert Lamberton',
			Editor: 'N/A',
			Quantity: 3,
			Price: 10,
			Year: 2017,
			OutOfPrint: false,
			EditedBy: '',
			Classification: ''
		}
	];
</script>

<Hst.Story title="Table">
	<Hst.Variant>
		<InventoryTable>
			{#each data as rowData}
				<InventoryRow {rowData} />
			{/each}
		</InventoryTable>
	</Hst.Variant>
</Hst.Story>
